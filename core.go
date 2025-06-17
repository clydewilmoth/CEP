package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"os/user"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/atotto/clipboard"
	"github.com/google/uuid"
	mssql "github.com/microsoft/go-mssqldb"
	ws "github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

func parseTimestampFlexible(ts string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339Nano, ts)
	if err == nil {
		return t, nil
	}
	t, err = time.Parse(time.RFC3339, ts)
	if err == nil {
		return t, nil
	}
	const mssqlFormat = "2006-01-02 15:04:05.9999999"
	t, err = time.Parse(mssqlFormat, ts)
	if err == nil {
		return t, nil
	}
	log.Printf("Failed to parse timestamp '%s': %v", ts, err)
	return time.Time{}, fmt.Errorf("unsupported timestamp format: %s", ts)
}

type Core struct {
	ctx            context.Context
	listenerCancel context.CancelFunc
	DB             *gorm.DB
	queueName      string
	serviceName    string
}

func NewCore() *Core {
	return &Core{}
}

func (c *Core) startup(ctx context.Context) {
	c.ctx = ctx
}

func (c *Core) HandleExport(entityType string, entityID string) string {
	file, _ := ws.SaveFileDialog(c.ctx, ws.SaveDialogOptions{
		DefaultFilename: fmt.Sprintf("%s_%s_export.json", entityType, entityID),
		Title:           "Export",
		Filters: []ws.FileFilter{
			{DisplayName: "JSON", Pattern: "*.json"},
			{DisplayName: "*", Pattern: "*.*"},
		},
	})
	err := c.ExportEntityHierarchyToJSON(entityType, entityID, file)
	if err != nil {
		return "ExportError"
	} else {
		return "ExportSuccess"
	}
}

func (c *Core) HandleImport(user string) string {
	file, _ := ws.OpenFileDialog(c.ctx, ws.OpenDialogOptions{
		Title: "Import",
		Filters: []ws.FileFilter{
			{DisplayName: "JSON", Pattern: "*.json"},
			{DisplayName: "*", Pattern: "*.*"},
		},
	})
	err := c.ImportEntityHierarchyFromJSON_UseOriginalData(user, file)
	if err != nil {
		return "ImportError"
	} else {
		return "ImportSuccess"
	}
}

func enableServiceBroker(sqlDB *sql.DB, dbName string) error {
	enableStmt := fmt.Sprintf(`IF (SELECT is_broker_enabled FROM sys.databases WHERE name = '%s') = 0
		 BEGIN
		   ALTER DATABASE [%s] SET ENABLE_BROKER;
		 END;`, dbName, dbName)

	if _, err := sqlDB.Exec(enableStmt); err != nil {
		if !strings.Contains(err.Error(), "already enabled") {
			return fmt.Errorf("failed to enable Service Broker: %w", err)
		}
	}

	log.Printf("Service Broker enabled on database: %s", dbName)
	return nil
}

func setupBroker(DB *gorm.DB, dbName string) (string, string, error) {
	sqlDB, err := DB.DB()
	if err != nil {
		return "", "", err
	}

	if err := enableServiceBroker(sqlDB, dbName); err != nil {
		return "", "", err
	}

	sessionID := uuid.New().String()
	queueName := fmt.Sprintf("DataChangeQueue_%s", strings.ReplaceAll(sessionID, "-", ""))
	serviceName := fmt.Sprintf("DataChangeService_%s", strings.ReplaceAll(sessionID, "-", ""))

	cleanupOrphanedResources(sqlDB)
	stmts := []string{
		`IF NOT EXISTS (SELECT * FROM sys.service_message_types WHERE name = 'DataChanged')
		 CREATE MESSAGE TYPE [DataChanged] VALIDATION = NONE;`,

		`IF NOT EXISTS (SELECT * FROM sys.service_contracts WHERE name = 'DataChangedContract')
		 CREATE CONTRACT [DataChangedContract] ([DataChanged] SENT BY INITIATOR);`,

		fmt.Sprintf(`IF NOT EXISTS (SELECT * FROM sys.service_queues WHERE name = '%s')
		 CREATE QUEUE [dbo].[%s];`, queueName, queueName),

		fmt.Sprintf(`IF NOT EXISTS (SELECT * FROM sys.services WHERE name = '%s')
		 CREATE SERVICE [%s] ON QUEUE [dbo].[%s] ([DataChangedContract]);`,
			serviceName, serviceName, queueName),

		`IF OBJECT_ID('dbo.TRG_app_metadata_Notify_All', 'TR') IS NULL
		 BEGIN
		   EXEC('CREATE TRIGGER dbo.TRG_app_metadata_Notify_All
		     ON dbo.app_metadata
		     AFTER INSERT, UPDATE, DELETE
		     AS
		     BEGIN
		       SET NOCOUNT ON;
		       
		       -- Send notification to ALL active DataChangeService queues
		       DECLARE @serviceName NVARCHAR(256);
		       DECLARE service_cursor CURSOR FOR
		         SELECT name FROM sys.services 
		         WHERE name LIKE ''DataChangeService_%'';
		       
		       OPEN service_cursor;
		       FETCH NEXT FROM service_cursor INTO @serviceName;
		       
		       WHILE @@FETCH_STATUS = 0
		       BEGIN
		         BEGIN TRY
		           DECLARE @dialog UNIQUEIDENTIFIER;
		           BEGIN DIALOG CONVERSATION @dialog
		             FROM SERVICE @serviceName
		             TO SERVICE @serviceName
		             ON CONTRACT [DataChangedContract]
		             WITH ENCRYPTION = OFF;

		           SEND ON CONVERSATION @dialog
		             MESSAGE TYPE [DataChanged]
		             (''database_changed'');
		             
		           END CONVERSATION @dialog;
		         END TRY
		         BEGIN CATCH
		           -- Ignore errors for inactive services
		         END CATCH
		         
		         FETCH NEXT FROM service_cursor INTO @serviceName;
		       END;
		       
		       CLOSE service_cursor;
		       DEALLOCATE service_cursor;
		     END;');
		 END;`,
	}

	for _, stmt := range stmts {
		if _, err := sqlDB.Exec(stmt); err != nil {
			if !strings.Contains(err.Error(), "already enabled") {
				log.Printf("Warning: Service Broker setup issue: %v", err)
			}
		}
	}
	log.Printf("Service Broker setup completed for session: %s", sessionID)
	return queueName, serviceName, nil
}

func (c *Core) listenForChanges(ctx context.Context, sqlDB *sql.DB, dsn string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("PANIC in listenForChanges: %v", r)
		}
	}()

	log.Printf("Starting Service Broker listener (session: %s)", c.queueName)

	for {
		select {
		case <-ctx.Done():
			log.Println("Listener stopped (context canceled)")
			return
		default:
		}

		query := fmt.Sprintf(`
			WAITFOR (
				RECEIVE TOP(1) message_body 
				FROM [dbo].[%s]
			), TIMEOUT 30000;
		`, c.queueName)

		ctx_timeout, cancel := context.WithTimeout(ctx, 35*time.Second)
		row := sqlDB.QueryRowContext(ctx_timeout, query)

		var messageBody sql.NullString
		err := row.Scan(&messageBody)
		cancel()
		if err != nil {
			if ctx.Err() != nil {
				log.Println("Listener stopped due to context cancellation")
				return
			}

			if strings.Contains(err.Error(), "Invalid object name") &&
				(strings.Contains(err.Error(), "DataChangeQueue_") || strings.Contains(err.Error(), "DataChangeService_")) {
				log.Printf("Service Broker resources no longer exist (cleaned up by another instance): %v", err)
				log.Printf("Listener exiting - resources deleted (session: %s)", c.queueName)

				c.queueName = ""
				c.serviceName = ""

				ws.EventsEmit(ctx, "database:connection_lost", "Service Broker resources removed")
				return
			}

			if strings.Contains(err.Error(), "connection") ||
				strings.Contains(err.Error(), "network") ||
				strings.Contains(err.Error(), "timeout") ||
				strings.Contains(err.Error(), "database is closed") ||
				strings.Contains(err.Error(), "transport") {
				log.Printf("Database connection lost: %v", err)

				c.cleanupBrokerWithDeadConnection(dsn)

				ws.EventsEmit(ctx, "database:connection_lost", err.Error())

				log.Printf("Listener exiting due to connection loss (session: %s)", c.queueName)
				return
			}

			if strings.Contains(err.Error(), "no rows") ||
				strings.Contains(err.Error(), "WAITFOR") ||
				strings.Contains(err.Error(), "timeout") {
				continue
			}

			log.Printf("Service Broker listener error: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		if messageBody.Valid {
			log.Printf("Database change notification received: %s", messageBody.String)
			ts, _ := c.GetGlobalLastUpdateTimestamp()
			ws.EventsEmit(ctx, "database:changed", ts)
		}
	}
}

const GlobalMetadataKey = "global_state"
const OpTypeUpdate = "UPDATE"
const OpTypeDelete = "DELETE"
const OpTypeSystemEvent = "SYSTEM_EVENT"

func (c *Core) InitDB(dsn string) string {
	if c.listenerCancel != nil {
		c.listenerCancel()
		c.listenerCancel = nil
		time.Sleep(100 * time.Millisecond)
	}

	c.cleanupBroker()

	if c.queueName != "" || c.serviceName != "" {
		c.cleanupBrokerWithDeadConnection(dsn)
	}

	if c.DB != nil {
		sqlDB, err := c.DB.DB()
		if err == nil {
			sqlDB.Close()
		}
		c.DB = nil
	}

	c.queueName = ""
	c.serviceName = ""
	if dsn == "" {
		return "InitError"
	}
	gormLogLevel := logger.Warn

	var err error
	c.DB, err = gorm.Open(sqlserver.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(gormLogLevel)})
	if err != nil {
		return "InitError"
	}
	err = c.DB.AutoMigrate(
		&Line{}, &Station{}, &Tool{}, &Operation{}, &SequenceGroup{},
		&AppMetadata{}, &EntityChangeLog{},
		&LineHistory{}, &StationHistory{}, &ToolHistory{}, &OperationHistory{},
	)
	if err != nil {
		return "InitError"
	}
	ensureAppMetadataExists(c.DB)
	u, err := url.Parse(dsn)
	if err != nil {
		return "InitError"
	}
	dbName := u.Query().Get("database")
	queueName, serviceName, err := setupBroker(c.DB, dbName)
	if err != nil {
		return "InitError"
	}
	c.queueName = queueName
	c.serviceName = serviceName
	log.Println("Service Broker setup complete")

	sqlDB, err := c.DB.DB()
	if err != nil {
		return "InitError"
	}

	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	if c.ctx == nil {
		log.Println("WARN: c.ctx ist nil, Listener wird nicht gestartet!")
		return "InitSuccess"
	}
	listenerCtx, cancel := context.WithCancel(c.ctx)
	c.listenerCancel = cancel
	go c.listenForChanges(listenerCtx, sqlDB, dsn)

	log.Println("Successfully connected to and migrated MS SQL server DB.")
	return "InitSuccess"
}
func ensureAppMetadataExists(db *gorm.DB) {
	var meta AppMetadata
	err := db.Where("config_key = ?", GlobalMetadataKey).Take(&meta).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		initialMeta := AppMetadata{ConfigKey: GlobalMetadataKey, LastUpdate: time.Now()}
		if creationErr := db.Create(&initialMeta).Error; creationErr != nil {
			log.Printf("Warning: failed to create initial app metadata: %v", creationErr)
		}
	} else if err != nil {
		log.Printf("Warning: error checking app metadata: %v", err)
	}
}

func (c *Core) GetPlatformSpecificUserName() string {
	currentUser, err := user.Current()
	if err != nil {
		log.Printf("Warning: Could not get current OS user: %v. Returning empty string.", err)
		return ""
	}
	username := currentUser.Username
	if runtime.GOOS == "windows" {
		if strings.Contains(username, "\\") {
			parts := strings.Split(username, "\\")
			if len(parts) > 1 {
				return parts[len(parts)-1]
			}
		}
	}
	return username
}
func updateGlobalLastUpdateTimestampAndLogChange(tx *gorm.DB, entityID mssql.UniqueIdentifier, entityType string, operationType string, userID *string, changedFields map[string]string) error {
	now := time.Now()
	if err := tx.Model(&AppMetadata{}).Where("config_key = ?", GlobalMetadataKey).Update("last_update", now).Error; err != nil {
		return fmt.Errorf("failed to update global timestamp: %w", err)
	}
	var emptyMsSQLID mssql.UniqueIdentifier
	if operationType == OpTypeUpdate || operationType == OpTypeDelete || (operationType == OpTypeSystemEvent && entityType == "system") {
		if entityID == emptyMsSQLID && entityType != "system" {
			return fmt.Errorf("entityID is required for logging %s on %s", operationType, entityType)
		}
		if entityType == "" && operationType != OpTypeSystemEvent {
			return fmt.Errorf("entityType is required for logging %s", operationType)
		}
		logEntityType := strings.ToLower(entityType)
		if operationType == OpTypeSystemEvent && entityType == "" {
			logEntityType = "system"
		}

		var changedFieldsJSON *string
		if operationType == OpTypeUpdate && changedFields != nil && len(changedFields) > 0 {
			if jsonBytes, err := json.Marshal(changedFields); err == nil {
				changedFieldsStr := string(jsonBytes)
				changedFieldsJSON = &changedFieldsStr
			}
		}

		changeLog := EntityChangeLog{
			EntityID:        entityID,
			EntityType:      logEntityType,
			OperationType:   operationType,
			ChangedFields:   changedFieldsJSON,
			ChangeTime:      now,
			ChangedByUserID: userID,
		}
		if err := tx.Create(&changeLog).Error; err != nil {
			return fmt.Errorf("failed to create entity change log for %s on %s (ID: %s): %w", operationType, entityType, entityID.String(), err)
		}
	}
	return nil
}
func (c *Core) GetGlobalLastUpdateTimestamp() (string, error) {
	if c.DB == nil {
		return "", errors.New("DB not initialized")
	}
	var meta AppMetadata
	if err := c.DB.Where("config_key = ?", GlobalMetadataKey).Take(&meta).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			nowTime := time.Now()
			go c.DB.Create(&AppMetadata{ConfigKey: GlobalMetadataKey, LastUpdate: nowTime})
			return nowTime.Format(time.RFC3339Nano), nil
		}
		return "", fmt.Errorf("failed to get global last update timestamp: %w", err)
	}
	return meta.LastUpdate.Format(time.RFC3339Nano), nil
}

type ChangeResponse struct {
	NewGlobalLastUpdatedAt string                              `json:"newGlobalLastUpdatedAt"`
	UpdatedEntities        map[string][]map[string]interface{} `json:"updatedEntities"`
	DeletedEntities        map[string][]string                 `json:"deletedEntities"`
}

func (c *Core) collectAllChildIDs(entityType string, entityID mssql.UniqueIdentifier) (map[string][]string, error) {
	result := make(map[string][]string)
	idStr := entityID.String()

	result[entityType] = append(result[entityType], idStr)

	switch entityType {
	case "line":
		var stations []Station
		if err := c.DB.Where("parent_id = ?", entityID).Find(&stations).Error; err != nil {
			return result, err
		}
		for _, s := range stations {
			childResults, err := c.collectAllChildIDs("station", s.ID)
			if err != nil {
				return result, err
			}
			for childType, childIDs := range childResults {
				result[childType] = append(result[childType], childIDs...)
			}
		}
	case "station":
		var tools []Tool
		if err := c.DB.Where("parent_id = ?", entityID).Find(&tools).Error; err != nil {
			return result, err
		}
		for _, t := range tools {
			childResults, err := c.collectAllChildIDs("tool", t.ID)
			if err != nil {
				return result, err
			}
			for childType, childIDs := range childResults {
				result[childType] = append(result[childType], childIDs...)
			}
		}
	case "tool":
		var ops []Operation
		if err := c.DB.Where("parent_id = ?", entityID).Find(&ops).Error; err != nil {
			return result, err
		}
		for _, o := range ops {
			childResults, err := c.collectAllChildIDs("operation", o.ID)
			if err != nil {
				return result, err
			}
			for childType, childIDs := range childResults {
				result[childType] = append(result[childType], childIDs...)
			}
		}
	}
	return result, nil
}

func (c *Core) GetChangesSince(clientLastKnownTimestampStr string) (*ChangeResponse, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	clientLastKnownTime, err := parseTimestampFlexible(clientLastKnownTimestampStr)
	if err != nil {
		return nil, fmt.Errorf("invalid clientLastKnownTimestampStr format: %w", err)
	}
	currentGlobalTsStr, err := c.GetGlobalLastUpdateTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get current global update timestamp: %w", err)
	}
	currentGlobalTime, _ := parseTimestampFlexible(currentGlobalTsStr)
	response := &ChangeResponse{NewGlobalLastUpdatedAt: currentGlobalTsStr, UpdatedEntities: make(map[string][]map[string]interface{}), DeletedEntities: make(map[string][]string)}
	if currentGlobalTime.After(clientLastKnownTime) {
		var logs []EntityChangeLog
		if err := c.DB.Where("change_time > ?", clientLastKnownTime).Order("change_time asc").Find(&logs).Error; err != nil {
			return nil, fmt.Errorf("failed to fetch change logs: %w", err)
		}
		processedUpdatedIDs := make(map[string]bool)
		processedDeletedIDs := make(map[string]bool)
		for _, lg := range logs {
			idStr := lg.EntityID.String()
			key := lg.EntityType + "_" + idStr
			if lg.OperationType == OpTypeSystemEvent {
				if _, ok := response.UpdatedEntities["system_event"]; !ok {
					response.UpdatedEntities["system_event"] = []map[string]interface{}{}
				}
				response.UpdatedEntities["system_event"] = append(response.UpdatedEntities["system_event"], map[string]interface{}{"id": idStr, "entityType": lg.EntityType})
			} else if lg.OperationType == OpTypeDelete && !processedDeletedIDs[key] {
				if _, ok := response.DeletedEntities[lg.EntityType]; !ok {
					response.DeletedEntities[lg.EntityType] = []string{}
				}
				response.DeletedEntities[lg.EntityType] = append(response.DeletedEntities[lg.EntityType], idStr)
				processedDeletedIDs[key] = true
				delete(processedUpdatedIDs, key)
			} else if lg.OperationType == OpTypeUpdate && !processedUpdatedIDs[key] {
				var changedFields map[string]string
				if lg.ChangedFields != nil && *lg.ChangedFields != "" {
					_ = json.Unmarshal([]byte(*lg.ChangedFields), &changedFields)
				}
				if _, ok := response.UpdatedEntities[lg.EntityType]; !ok {
					response.UpdatedEntities[lg.EntityType] = []map[string]interface{}{}
				}
				response.UpdatedEntities[lg.EntityType] = append(response.UpdatedEntities[lg.EntityType], map[string]interface{}{"id": idStr, "changedFields": changedFields})
				processedUpdatedIDs[key] = true
			}
		}
	}
	return response, nil
}
func parseMSSQLUniqueIdentifierFromString(idStr string) (mssql.UniqueIdentifier, error) {
	if idStr == "" {
		var uid mssql.UniqueIdentifier
		return uid, errors.New("ID string must not be empty")
	}
	var uid mssql.UniqueIdentifier
	err := uid.Scan(idStr)
	if err != nil {
		gUUID, errParse := uuid.Parse(idStr)
		if errParse == nil {
			errScanMs := uid.Scan(gUUID[:])
			if errScanMs == nil {
				return uid, nil
			}
		}
		return uid, fmt.Errorf("invalid UniqueIdentifier format for ID '%s': %w", idStr, err)
	}
	return uid, nil
}
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
func getModelInstance(entityTypeStr string) (interface{}, error) {
	switch strings.ToLower(entityTypeStr) {
	case "line":
		return &Line{}, nil
	case "station":
		return &Station{}, nil
	case "tool":
		return &Tool{}, nil
	case "operation":
		return &Operation{}, nil
	case "sequencegroup":
		return &SequenceGroup{}, nil
	case "appmetadata":
		return &AppMetadata{}, nil
	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityTypeStr)
	}
}

type HierarchyResponse struct {
	Data                interface{} `json:"data"`
	GlobalLastUpdatedAt string      `json:"globalLastUpdatedAt"`
}

func getIDFromModel(entity interface{}) mssql.UniqueIdentifier {
	switch e := entity.(type) {
	case *Line:
		return e.ID
	case *Station:
		return e.ID
	case *Tool:
		return e.ID
	case *Operation:
		return e.ID
	case *SequenceGroup:
		return e.ID
	default:
		var emptyID mssql.UniqueIdentifier
		return emptyID
	}
}

func (c *Core) CreateEntity(userName string, entityTypeStr string, parentIDStrIfApplicable string) (interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	if userName == "" {
		return nil, errors.New("userName is required for creation")
	}
	var parentIDmssql mssql.UniqueIdentifier
	var err error
	base := BaseModel{CreatedBy: strPtr(userName), UpdatedBy: strPtr(userName)}
	var entityToCreate interface{}
	entityTypeNormalized := strings.ToLower(entityTypeStr)
	switch entityTypeNormalized {
	case "line":
		entityToCreate = &Line{BaseModel: base}
	case "station":
		if parentIDStrIfApplicable == "" {
			return nil, fmt.Errorf("ParentID is required for %s", entityTypeStr)
		}
		parentIDmssql, err = parseMSSQLUniqueIdentifierFromString(parentIDStrIfApplicable)
		if err != nil {
			return nil, fmt.Errorf("invalid ParentID for %s: %w", entityTypeStr, err)
		}
		entityToCreate = &Station{BaseModel: base, ParentID: parentIDmssql}
	case "tool":
		if parentIDStrIfApplicable == "" {
			return nil, fmt.Errorf("ParentID is required for %s", entityTypeStr)
		}
		parentIDmssql, err = parseMSSQLUniqueIdentifierFromString(parentIDStrIfApplicable)
		if err != nil {
			return nil, fmt.Errorf("invalid ParentID for %s: %w", entityTypeStr, err)
		}
		entityToCreate = &Tool{BaseModel: base, ParentID: parentIDmssql}
	case "operation":
		if parentIDStrIfApplicable == "" {
			return nil, fmt.Errorf("ParentID is required for %s", entityTypeStr)
		}
		parentIDmssql, err = parseMSSQLUniqueIdentifierFromString(parentIDStrIfApplicable)
		if err != nil {
			return nil, fmt.Errorf("invalid ParentID for %s: %w", entityTypeStr, err)
		}
		entityToCreate = &Operation{BaseModel: base, ParentID: parentIDmssql}
	default:
		return nil, fmt.Errorf("unknown entity type for Create: %s", entityTypeStr)
	}
	err = c.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(entityToCreate).Error; err != nil {
			return fmt.Errorf("DB error creating %s: %w", entityTypeStr, err)
		}
		return tx.Model(&AppMetadata{}).Where("config_key = ?", GlobalMetadataKey).Update("last_update", time.Now()).Error
	})
	if err != nil {
		return nil, err
	}
	reloadedEntity, _ := getModelInstance(entityTypeNormalized)
	createdEntityID := getIDFromModel(entityToCreate)
	var emptyIDcheck mssql.UniqueIdentifier
	if createdEntityID == emptyIDcheck {
		return nil, errors.New("created entity ID is nil after create, cannot reload")
	}
	if errReload := c.DB.First(reloadedEntity, "id = ?", createdEntityID).Error; errReload != nil {
		return nil, fmt.Errorf("error reloading entity (ID: %s) after create: %w", createdEntityID.String(), errReload)
	}
	return reloadedEntity, nil
}

func (c *Core) CreateEntitySequenceGroup(userName string, entityTypeStr string, parentIDStrIfApplicable string, sequenceGroupName string) (interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	if userName == "" {
		return nil, errors.New("userName is required for creation")
	}

	entityTypeNormalized := strings.ToLower(entityTypeStr)
	if entityTypeNormalized != "sequencegroup" {
		return nil, fmt.Errorf("unsupported entity type for Create: %s", entityTypeStr)
	}

	if parentIDStrIfApplicable == "" {
		return nil, fmt.Errorf("ParentID is required for %s", entityTypeStr)
	}
	parentIDmssql, err := parseMSSQLUniqueIdentifierFromString(parentIDStrIfApplicable)
	if err != nil {
		return nil, fmt.Errorf("invalid ParentID for %s: %w", entityTypeStr, err)
	}

	base := BaseModel{CreatedBy: strPtr(userName), UpdatedBy: strPtr(userName)}

	var highest int
	var groups []SequenceGroup
	if err := c.DB.Where("parent_id = ?", parentIDmssql).Find(&groups).Error; err != nil {
		return nil, fmt.Errorf("DB error reading SequenceGroups: %w", err)
	}
	for _, g := range groups {
		if parsed, err := strconv.Atoi(*g.Index); err == nil {
			if parsed > highest {
				highest = parsed
			}
		}
	}
	newIndex := strconv.Itoa(highest + 1)
	base.Name = strPtr(sequenceGroupName)
	entityToCreate := &SequenceGroup{BaseModel: base, ParentID: parentIDmssql, Index: &newIndex}

	err = c.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(entityToCreate).Error; err != nil {
			return fmt.Errorf("DB error creating %s: %w", entityTypeStr, err)
		}
		return tx.Model(&AppMetadata{}).Where("config_key = ?", GlobalMetadataKey).Update("last_update", time.Now()).Error
	})
	if err != nil {
		return nil, err
	}

	reloadedEntity := &SequenceGroup{}
	createdEntityID := getIDFromModel(entityToCreate)
	var emptyIDcheck mssql.UniqueIdentifier
	if createdEntityID == emptyIDcheck {
		return nil, errors.New("created entity ID is nil after create, cannot reload")
	}
	if errReload := c.DB.First(reloadedEntity, "id = ?", createdEntityID).Error; errReload != nil {
		return nil, fmt.Errorf("error reloading entity (ID: %s) after create: %w", createdEntityID.String(), errReload)
	}
	return reloadedEntity, nil
}

// createVersion saves the current state of an entity to its history table.
func createVersion(tx *gorm.DB, entityTypeStr string, entityData interface{}) error {
	var nextVersion int64
	var historyModel interface{}
	var entityID mssql.UniqueIdentifier

	switch v := entityData.(type) {
	case *Line:
		historyModel = &LineHistory{}
		entityID = v.ID
	case *Station:
		historyModel = &StationHistory{}
		entityID = v.ID
	case *Tool:
		historyModel = &ToolHistory{}
		entityID = v.ID
	case *Operation:
		historyModel = &OperationHistory{}
		entityID = v.ID
	default:
		return fmt.Errorf("unknown entity type for versioning: %s", entityTypeStr)
	}

	// Determine the next version number.
	if err := tx.Model(historyModel).Where("entity_id = ?", entityID).Count(&nextVersion).Error; err != nil {
		return fmt.Errorf("failed to count existing versions for %s: %w", entityID, err)
	}
	nextVersion++ // Increment to get the new version number (starts at 1).

	// Populate and save the history record.
	switch v := entityData.(type) {
	case *Line:
		historyRecord := LineHistory{
			Version:      int(nextVersion),
			EntityID:     v.ID,
			Name:         v.Name,
			Comment:      v.Comment,
			StatusColor:  v.StatusColor,
			CreatedAt:    v.CreatedAt,
			UpdatedAt:    v.UpdatedAt,
			CreatedBy:    v.CreatedBy,
			UpdatedBy:    v.UpdatedBy,
			AssemblyArea: v.AssemblyArea,
		}
		return tx.Create(&historyRecord).Error
	case *Station:
		historyRecord := StationHistory{
			Version:     int(nextVersion),
			EntityID:    v.ID,
			Name:        v.Name,
			Comment:     v.Comment,
			StatusColor: v.StatusColor,
			CreatedAt:   v.CreatedAt,
			UpdatedAt:   v.UpdatedAt,
			CreatedBy:   v.CreatedBy,
			UpdatedBy:   v.UpdatedBy,
			Description: v.Description,
			StationType: v.StationType,
			ParentID:    v.ParentID,
		}
		return tx.Create(&historyRecord).Error
	case *Tool:
		historyRecord := ToolHistory{
			Version:               int(nextVersion),
			EntityID:              v.ID,
			Name:                  v.Name,
			Comment:               v.Comment,
			StatusColor:           v.StatusColor,
			CreatedAt:             v.CreatedAt,
			UpdatedAt:             v.UpdatedAt,
			CreatedBy:             v.CreatedBy,
			UpdatedBy:             v.UpdatedBy,
			ToolClass:             v.ToolClass,
			ToolType:              v.ToolType,
			Description:           v.Description,
			IpAddressDevice:       v.IpAddressDevice,
			SPSPLCNameSPAService:  v.SPSPLCNameSPAService,
			SPSDBNoSend:           v.SPSDBNoSend,
			SPSDBNoReceive:        v.SPSDBNoReceive,
			SPSPreCheck:           v.SPSPreCheck,
			SPSAddressInSendDB:    v.SPSAddressInSendDB,
			SPSAddressInReceiveDB: v.SPSAddressInReceiveDB,
			ParentID:              v.ParentID,
		}
		return tx.Create(&historyRecord).Error
	case *Operation:
		historyRecord := OperationHistory{
			Version:           int(nextVersion),
			EntityID:          v.ID,
			Name:              v.Name,
			Comment:           v.Comment,
			StatusColor:       v.StatusColor,
			CreatedAt:         v.CreatedAt,
			UpdatedAt:         v.UpdatedAt,
			CreatedBy:         v.CreatedBy,
			UpdatedBy:         v.UpdatedBy,
			Description:       v.Description,
			DecisionCriteria:  v.DecisionCriteria,
			SerialOrParallel:  v.SerialOrParallel,
			SequenceGroup:     v.SequenceGroup,
			Sequence:          v.Sequence,
			AlwaysPerform:     v.AlwaysPerform,
			QGateRelevant:     v.QGateRelevant,
			Template:          v.Template,
			DecisionClass:     v.DecisionClass,
			SavingClass:       v.SavingClass,
			VerificationClass: v.VerificationClass,
			GenerationClass:   v.GenerationClass,
			ParentID:          v.ParentID,
		}
		return tx.Create(&historyRecord).Error
	}
	return fmt.Errorf("unhandled entity type in createVersion switch: %T", entityData)
}

func (c *Core) UpdateEntityFieldsString(userName string, entityTypeStr string, entityIDStr string, lastKnownUpdatedAtStr string, updatesMapStr map[string]string) (interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	if userName == "" {
		return nil, errors.New("userName is required for update")
	}
	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return nil, err
	}
	lastKnownUpdatedAt, err := parseTimestampFlexible(lastKnownUpdatedAtStr)
	if err != nil {
		return nil, fmt.Errorf("invalid updated_at format ('%s'): %w", lastKnownUpdatedAtStr, err)
	}

	var finalModelInstance interface{}
	err = c.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Get a pointer to the correct model struct type.
		modelToUpdate, err := getModelInstance(entityTypeStr)
		if err != nil {
			return err
		}

		// 2. Fetch the current state of the entity from the database.
		if err := tx.First(modelToUpdate, "id = ?", entityIDmssql).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("record not found or already deleted")
			}
			return fmt.Errorf("error loading entity for update: %w", err)
		}

		// 3. Concurrency Check: Ensure the client is updating the version they think they are.
		var currentDBUpdatedAt time.Time
		switch e := modelToUpdate.(type) {
		case *Line:
			currentDBUpdatedAt = e.UpdatedAt
		case *Station:
			currentDBUpdatedAt = e.UpdatedAt
		case *Tool:
			currentDBUpdatedAt = e.UpdatedAt
		case *Operation:
			currentDBUpdatedAt = e.UpdatedAt
		default:
			return fmt.Errorf("unknown entity type for concurrency check: %T", e)
		}

		// Compare timestamps with a tiny tolerance for precision differences.
		if currentDBUpdatedAt.After(lastKnownUpdatedAt.Add(time.Millisecond)) {
			log.Printf("[Concurrency] Conflict detected: DB UpdatedAt=%s | Client Known UpdatedAt=%s", currentDBUpdatedAt.UTC().Format(time.RFC3339Nano), lastKnownUpdatedAt.UTC().Format(time.RFC3339Nano))
			return errors.New("conflict: record was modified by another user")
		}

		// 4. Create a history version of the entity state BEFORE the update.
		if err := createVersion(tx, entityTypeStr, modelToUpdate); err != nil {
			return fmt.Errorf("failed to create entity version: %w", err)
		}

		// 5. Prepare and apply the updates to the live entity.
		gormUpdates := make(map[string]interface{})
		for k, v := range updatesMapStr {
			gormUpdates[k] = strPtr(v)
		}
		gormUpdates["updated_by"] = strPtr(userName)
		gormUpdates["updated_at"] = time.Now() // Explicitly set timestamp

		if errUpdate := tx.Model(modelToUpdate).Where("id = ?", entityIDmssql).Updates(gormUpdates).Error; errUpdate != nil {
			return fmt.Errorf("error updating DB: %w", errUpdate)
		}

		// 6. Reload the entity within the transaction to return the final state.
		reloadedEntityWithinTx, _ := getModelInstance(entityTypeStr)
		if errLoad := tx.First(reloadedEntityWithinTx, "id = ?", entityIDmssql).Error; errLoad != nil {
			return fmt.Errorf("error reloading entity after update within tx: %w", errLoad)
		}
		finalModelInstance = reloadedEntityWithinTx

		// 7. Update global timestamp and log the change.
		return updateGlobalLastUpdateTimestampAndLogChange(tx, entityIDmssql, strings.ToLower(entityTypeStr), OpTypeUpdate, strPtr(userName), updatesMapStr)
	})

	if err != nil {
		return nil, err
	}
	return finalModelInstance, nil
}

func (c *Core) UpdateEntityFieldsStringSequenceGroup(userName string, entityTypeStr string, entityIDStr string, lastKnownUpdatedAtStr string, updatesMapStr map[string]string) (interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	if userName == "" {
		return nil, errors.New("userName is required for update")
	}

	entityTypeNormalized := strings.ToLower(entityTypeStr)
	if entityTypeNormalized != "sequencegroup" && entityTypeNormalized != "operation" {
		return nil, fmt.Errorf("unsupported entity type: %s", entityTypeStr)
	}

	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return nil, err
	}
	lastKnownUpdatedAt, err := parseTimestampFlexible(lastKnownUpdatedAtStr)
	if err != nil {
		return nil, fmt.Errorf("invalid updated_at format ('%s'): %w", lastKnownUpdatedAtStr, err)
	}

	var modelToUpdate interface{}
	switch entityTypeNormalized {
	case "sequencegroup":
		modelToUpdate = &SequenceGroup{}
	case "operation":
		modelToUpdate = &Operation{}
	}

	var finalModelInstance interface{}
	err = c.DB.Transaction(func(tx *gorm.DB) error {
		switch entityTypeNormalized {
		case "sequencegroup":
			var m SequenceGroup
			if err := tx.Where("id = ?", entityIDmssql).Take(&m).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.New("record not found or already deleted")
				}
				return fmt.Errorf("error loading entity for update check: %w", err)
			}
		case "operation":
			var m Operation
			if err := tx.Where("id = ?", entityIDmssql).Take(&m).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.New("record not found or already deleted")
				}
				return fmt.Errorf("error loading entity for update check: %w", err)
			}
		}

		currentGlobalTsStr, err := c.GetGlobalLastUpdateTimestamp()
		if err != nil {
			return fmt.Errorf("failed to get global last update timestamp: %w", err)
		}
		currentDBUpdatedAt, err := parseTimestampFlexible(currentGlobalTsStr)
		if err != nil {
			return fmt.Errorf("failed to parse global last update timestamp: %w", err)
		}
		if currentDBUpdatedAt.UTC().Before(lastKnownUpdatedAt.UTC()) {
			log.Printf("[Concurrency] Conflict detected: DB UpdatedAt=%s | Client UpdatedAt=%s", currentDBUpdatedAt.UTC().Format(time.RFC3339Nano), lastKnownUpdatedAt.UTC().Format(time.RFC3339Nano))
			return errors.New("conflict: record was modified by another user")
		}

		gromUpdates := make(map[string]interface{})
		for k, v := range updatesMapStr {
			gromUpdates[k] = strPtr(v)
		}
		gromUpdates["updated_by"] = strPtr(userName)
		gromUpdates["updated_at"] = time.Now()
		if err := tx.Model(modelToUpdate).Where("id = ?", entityIDmssql).Updates(gromUpdates).Error; err != nil {
			return fmt.Errorf("error updating DB: %w", err)
		}

		reloadedEntity := modelToUpdate
		if err := tx.First(reloadedEntity, "id = ?", entityIDmssql).Error; err != nil {
			return fmt.Errorf("error reloading entity after update within tx: %w", err)
		}
		finalModelInstance = reloadedEntity

		// Nur Änderungen an Operationen in den Changelog schreiben
		if entityTypeNormalized == "operation" {
			return updateGlobalLastUpdateTimestampAndLogChange(tx, entityIDmssql, entityTypeNormalized, OpTypeUpdate, strPtr(userName), updatesMapStr)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return finalModelInstance, nil
}

func (c *Core) GetEntityDetails(entityTypeStr string, entityIDStr string) (interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return nil, err
	}
	modelInstance, err := getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	if err := c.DB.Where("id = ?", entityIDmssql).Take(modelInstance).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("entity type %s with ID %s not found", entityTypeStr, entityIDStr)
		}
		return nil, fmt.Errorf("error loading entity type %s with ID %s: %w", entityTypeStr, entityIDStr, err)
	}
	return modelInstance, nil
}

func (c *Core) GetAllEntities(entityTypeStr string, parentIDStr_optional string) ([]interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	modelInstance, err := getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	var results []interface{}
	query := c.DB.Model(modelInstance).Order("created_at asc")
	if parentIDStr_optional != "" {
		parentIDmssql, err := parseMSSQLUniqueIdentifierFromString(parentIDStr_optional)
		if err != nil {
			return nil, fmt.Errorf("invalid parentID for GetAllEntities: %w", err)
		}
		query = query.Where("parent_id = ?", parentIDmssql)
	} else {
		if strings.ToLower(entityTypeStr) != "line" {
			return nil, errors.New("ParentID is required for non-line entities in GetAllEntities")
		}
	}
	switch strings.ToLower(entityTypeStr) {
	case "line":
		var items []Line
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "station":
		var items []Station
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "tool":
		var items []Tool
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "operation":
		var items []Operation
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "sequencegroup":
		var items []SequenceGroup
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	default:
		return nil, fmt.Errorf("GetAllEntities not implemented for type: %s", entityTypeStr)
	}
	return results, nil
}

func (c *Core) GetOperationsByStation(stationID string) ([]Operation, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	stationUUID, err := parseMSSQLUniqueIdentifierFromString(stationID)
	if err != nil {
		return nil, fmt.Errorf("invalid stationID: %w", err)
	}

	var tools []Tool
	if err := c.DB.Where("parent_id = ?", stationUUID).Find(&tools).Error; err != nil {
		return nil, fmt.Errorf("error loading tools for station: %w", err)
	}

	var toolIDs []mssql.UniqueIdentifier
	for _, t := range tools {
		toolIDs = append(toolIDs, t.ID)
	}
	if len(toolIDs) == 0 {
		return []Operation{}, nil
	}

	var ops []Operation
	if err := c.DB.Where("parent_id IN ?", toolIDs).Find(&ops).Error; err != nil {
		return nil, fmt.Errorf("error loading operations for tools: %w", err)
	}
	return ops, nil
}

func (c *Core) GetEntityHierarchyString(entityTypeStr string, entityIDStr string) (*HierarchyResponse, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	data, err := internalGetEntityHierarchy(c.DB, entityTypeStr, entityIDStr)
	if err != nil {
		return nil, err
	}
	globalTs, tsErr := c.GetGlobalLastUpdateTimestamp()
	if tsErr != nil {
		log.Printf("Warning: could not load global update timestamp: %v", tsErr)
	}
	return &HierarchyResponse{Data: data, GlobalLastUpdatedAt: globalTs}, nil
}

func internalGetEntityHierarchy(db *gorm.DB, entityTypeStr string, entityIDStr string) (interface{}, error) {
	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return nil, err
	}
	modelInstance, err := getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	txDB := db
	switch strings.ToLower(entityTypeStr) {
	case "line":
		txDB = txDB.Preload("Stations.Tools.Operations").Preload("Stations.SequenceGroups.Operations")
	case "station":
		txDB = txDB.Preload("Tools.Operations").Preload("SequenceGroups.Operations").Preload("Line")
	case "tool", "sequencegroup":
		txDB = txDB.Preload("Operations").Preload("Station.Line")
	case "operation":
		txDB = txDB.Preload("Tool.Station.Line").Preload("SequenceGroup.Station.Line")
	default:
		return nil, fmt.Errorf("hierarchical loading not defined for type: %s", entityTypeStr)
	}
	if err := txDB.First(modelInstance, "id = ?", entityIDmssql).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("entity type %s with ID %s not found for hierarchy", entityTypeStr, entityIDStr)
		}
		return nil, fmt.Errorf("error loading hierarchy for type %s, ID %s: %w", entityTypeStr, entityIDStr, err)
	}
	return modelInstance, nil
}

func (c *Core) ExportEntityHierarchyToJSON(entityTypeStr string, entityIDStr string, filePath string) error {
	if c.DB == nil {
		return errors.New("DB not initialized")
	}
	if filePath == "" {
		return errors.New("export filePath is empty")
	}
	hierarchyData, err := internalGetEntityHierarchy(c.DB, entityTypeStr, entityIDStr)
	if err != nil {
		return fmt.Errorf("error loading hierarchy for export: %w", err)
	}
	jsonData, err := json.MarshalIndent(hierarchyData, "", "  ")
	if err != nil {
		return fmt.Errorf("error converting to JSON: %w", err)
	}
	err = os.WriteFile(filePath, jsonData, 0644)
	if err != nil {
		return fmt.Errorf("error writing JSON file '%s': %w", filePath, err)
	}
	log.Printf("Hierarchy successfully exported to '%s'.", filePath)
	return nil
}

func (c *Core) ImportEntityHierarchyFromJSON_UseOriginalData(importingUserName string, filePath string) (err error) {
	if c.DB == nil {
		return errors.New("DB not initialized")
	}
	if filePath == "" {
		return errors.New("import filePath is empty")
	}
	log.Printf("Starting import from '%s' (using original data from JSON).", filePath)
	jsonData, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("error reading JSON file '%s': %w", filePath, err)
	}
	var rootImportedLine Line
	if err = json.Unmarshal(jsonData, &rootImportedLine); err != nil {
		return fmt.Errorf("error unmarshalling JSON: %w", err)
	}
	tx := c.DB.Begin()
	if tx.Error != nil {
		return fmt.Errorf("error starting DB transaction: %w", tx.Error)
	}
	var emptyMsSQLID mssql.UniqueIdentifier
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			log.Printf("Import aborted (Panic): %v", r)
		} else if err != nil {
			tx.Rollback()
			log.Printf("Import failed, rolling back: %v", err)
		} else {
			commitErr := tx.Commit().Error
			if commitErr != nil {
				log.Printf("Error committing transaction: %v", commitErr)
				err = commitErr
			} else {
				log.Println("Import (Original Data) committed successfully.")
			}
		}
	}()
	err = importEntityRecursive_UseOriginalData(tx, &rootImportedLine, "line", emptyMsSQLID)
	if err == nil {
		if errTimestamp := updateGlobalLastUpdateTimestampAndLogChange(tx, emptyMsSQLID, "system", OpTypeSystemEvent, strPtr(importingUserName), nil); errTimestamp != nil {
			log.Printf("Warning: failed to update global timestamp and log after successful import: %v", errTimestamp)
		}
	}
	return err
}
func importEntityRecursive_UseOriginalData(currentTx *gorm.DB, originalEntityData interface{}, entityTypeStr string, newParentActualID mssql.UniqueIdentifier) error {
	var currentEntityID mssql.UniqueIdentifier
	var currentEntityNamePtr *string
	var childrenToProcess []interface{}
	var childEntityTypeStr string
	var emptyMsSQLID mssql.UniqueIdentifier
	switch entity := originalEntityData.(type) {
	case *Line:
		if entity.ID == emptyMsSQLID {
			return fmt.Errorf("line in JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		childEntityTypeStr = "station"
		for i := range entity.Stations {
			childrenToProcess = append(childrenToProcess, &entity.Stations[i])
		}
	case *Station:
		if entity.ID == emptyMsSQLID {
			return fmt.Errorf("station in JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		entity.ParentID = newParentActualID
		childEntityTypeStr = "tool"
		for i := range entity.Tools {
			childrenToProcess = append(childrenToProcess, &entity.Tools[i])
		}
	case *Tool:
		if entity.ID == emptyMsSQLID {
			return fmt.Errorf("tool in JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		entity.ParentID = newParentActualID
		childEntityTypeStr = "operation"
		for i := range entity.Operations {
			childrenToProcess = append(childrenToProcess, &entity.Operations[i])
		}
	case *SequenceGroup:
		if entity.ID == emptyMsSQLID {
			return fmt.Errorf("sequenceGroup in JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		entity.ParentID = newParentActualID
		childEntityTypeStr = "operation"
		for i := range entity.Operations {
			childrenToProcess = append(childrenToProcess, &entity.Operations[i])
		}
	case *Operation:
		if entity.ID == emptyMsSQLID {
			return fmt.Errorf("operation in JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		entity.ParentID = newParentActualID
	default:
		return fmt.Errorf("unknown type in recursive import: %T", originalEntityData)
	}
	var logName string
	if currentEntityNamePtr != nil {
		logName = *currentEntityNamePtr
	} else {
		logName = "<NULL>"
	}
	modelToCheck, _ := getModelInstance(entityTypeStr)
	if err := currentTx.First(modelToCheck, "id = ?", currentEntityID).Error; err == nil {
		return fmt.Errorf("%s ID %s already exists. Import aborted", entityTypeStr, currentEntityID.String())
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("DB error checking %s ID %s: %w", entityTypeStr, currentEntityID.String(), err)
	}
	if err := currentTx.Omit(clause.Associations).Create(originalEntityData).Error; err != nil {
		return fmt.Errorf("error creating imported entity %s '%s' (ID: %s): %w", entityTypeStr, logName, currentEntityID.String(), err)
	}
	for _, childData := range childrenToProcess {
		if err := importEntityRecursive_UseOriginalData(currentTx, childData, childEntityTypeStr, currentEntityID); err != nil {
			return err
		}
	}
	return nil
}

func (c *Core) CopyEntityHierarchyToClipboard(entityTypeStr string, entityIDStr string) error {
	if c.DB == nil {
		return errors.New("DB not initialized")
	}

	entityTypeStr = strings.ToLower(entityTypeStr)

	var tx *gorm.DB
	switch entityTypeStr {
	case "line":
		tx = c.DB.Preload("Stations.Tools.Operations")
	case "station":
		tx = c.DB.Preload("Tools.Operations")
	case "tool":
		tx = c.DB.Preload("Operations")
	case "operation":
		tx = c.DB
	default:
		return fmt.Errorf("unsupported entity type: %s", entityTypeStr)
	}

	entityID, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return fmt.Errorf("invalid ID: %w", err)
	}

	modelInstance, err := getModelInstance(entityTypeStr)
	if err != nil {
		return err
	}

	if err := tx.First(modelInstance, "id = ?", entityID).Error; err != nil {
		return fmt.Errorf("error loading entity with hierarchy: %w", err)
	}

	if entityTypeStr == "operation" {
		if op, ok := modelInstance.(*Operation); ok {
			op.GroupID = nil
			op.SequenceGroup = nil
			op.Sequence = nil
		}
	}

	jsonData, err := json.MarshalIndent(modelInstance, "", "  ")
	if err != nil {
		return fmt.Errorf("error converting to JSON: %w", err)
	}

	if err := clipboard.WriteAll(string(jsonData)); err != nil {
		return fmt.Errorf("error writing to clipboard: %w", err)
	}

	log.Printf("Hierarchy of %s copied to clipboard successfully.", entityTypeStr)
	return nil
}

func (c *Core) PasteEntityHierarchyFromClipboard(userName string, expectedEntityType string, parentIDStrOptional string) error {
	if c.DB == nil {
		return errors.New("DB not initialized")
	}
	if userName == "" {
		return errors.New("userName is required")
	}

	clipboardData, err := clipboard.ReadAll()
	if err != nil {
		return fmt.Errorf("error reading from clipboard: %w", err)
	}

	actualEntityType, err := detectEntityTypeFromClipboard(clipboardData)
	if err != nil {
		return fmt.Errorf("could not detect entity type from clipboard: %w", err)
	}

	if !strings.EqualFold(actualEntityType, expectedEntityType) {
		return fmt.Errorf("type mismatch: clipboard contains '%s' but expected '%s'", actualEntityType, expectedEntityType)
	}

	var root interface{}
	switch strings.ToLower(expectedEntityType) {
	case "line":
		var line Line
		if err := json.Unmarshal([]byte(clipboardData), &line); err != nil {
			return fmt.Errorf("clipboard does not contain a valid Line: %w", err)
		}
		root = &line

	case "station":
		var station Station
		if err := json.Unmarshal([]byte(clipboardData), &station); err != nil {
			return fmt.Errorf("clipboard does not contain a valid Station: %w", err)
		}
		root = &station

	case "tool":
		var tool Tool
		if err := json.Unmarshal([]byte(clipboardData), &tool); err != nil {
			return fmt.Errorf("clipboard does not contain a valid Tool: %w", err)
		}
		root = &tool

	case "operation":
		var op Operation
		if err := json.Unmarshal([]byte(clipboardData), &op); err != nil {
			return fmt.Errorf("clipboard does not contain a valid Operation: %w", err)
		}
		root = &op

	default:
		return fmt.Errorf("unknown expected entity type: '%s'", expectedEntityType)
	}

	var parentID mssql.UniqueIdentifier
	if parentIDStrOptional != "" {
		parentID, err = parseMSSQLUniqueIdentifierFromString(parentIDStrOptional)
		if err != nil {
			return fmt.Errorf("invalid parent ID: %w", err)
		}
	}

	tx := c.DB.Begin()
	if tx.Error != nil {

		return fmt.Errorf("failed to begin transaction: %w", tx.Error)
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			log.Printf("Paste (panic): %v", r)
		} else if err != nil {
			tx.Rollback()
			log.Printf("Paste (failed): %v", err)
		} else {
			if commitErr := tx.Commit().Error; commitErr != nil {
				log.Printf("Commit error: %v", commitErr)
				err = commitErr
			} else {
				log.Println("Paste successful.")
			}
		}
	}()
	idMap := make(map[mssql.UniqueIdentifier]mssql.UniqueIdentifier)
	_, err = importCopiedEntityRecursive(tx, userName, root, expectedEntityType, parentID, idMap)
	if err != nil {
		return err
	}

	return tx.Model(&AppMetadata{}).Where("config_key = ?", GlobalMetadataKey).Update("last_update", time.Now()).Error
}

func detectEntityTypeFromClipboard(clipboardData string) (string, error) {
	var tempMap map[string]interface{}
	if err := json.Unmarshal([]byte(clipboardData), &tempMap); err != nil {
		return "", fmt.Errorf("clipboard does not contain valid JSON: %w", err)
	}
	if _, hasAssemblyArea := tempMap["AssemblyArea"]; hasAssemblyArea {
		if _, hasStations := tempMap["Stations"]; hasStations {
			return "line", nil

		}
	}
	if _, hasStationType := tempMap["StationType"]; hasStationType {
		if _, hasTools := tempMap["Tools"]; hasTools {
			return "station", nil
		}
	}

	if _, hasToolClass := tempMap["ToolClass"]; hasToolClass {
		if _, hasOperations := tempMap["Operations"]; hasOperations {
			return "tool", nil
		}
	}
	if _, hasDecisionCriteria := tempMap["DecisionCriteria"]; hasDecisionCriteria {
		if _, hasSequenceGroup := tempMap["SequenceGroup"]; hasSequenceGroup {
			return "operation", nil
		}
	}
	var line Line
	if err := json.Unmarshal([]byte(clipboardData), &line); err == nil && line.ID != (mssql.UniqueIdentifier{}) {
		return "line", nil
	}
	var station Station
	if err := json.Unmarshal([]byte(clipboardData), &station); err == nil && station.ID != (mssql.UniqueIdentifier{}) {
		return "station", nil
	}
	var tool Tool
	if err := json.Unmarshal([]byte(clipboardData), &tool); err == nil && tool.ID != (mssql.UniqueIdentifier{}) {
		return "tool", nil
	}
	var operation Operation
	if err := json.Unmarshal([]byte(clipboardData), &operation); err == nil && operation.ID != (mssql.UniqueIdentifier{}) {
		return "operation", nil
	}
	return "", errors.New("could not determine entity type from clipboard data")
}

func createBaseFromOriginal(original BaseModel, userName string) BaseModel {
	now := time.Now()
	newID := mssql.UniqueIdentifier{}
	_ = newID.Scan(uuid.New().String())

	return BaseModel{
		Name:        original.Name,
		Comment:     original.Comment,
		StatusColor: original.StatusColor,
		ID:          newID,
		CreatedAt:   now,
		UpdatedAt:   now,
		CreatedBy:   strPtr(userName),
		UpdatedBy:   strPtr(userName),
	}
}

func importCopiedEntityRecursive(
	tx *gorm.DB,
	userName string,
	original interface{},
	entityTypeStr string,
	newParentID mssql.UniqueIdentifier,
	idMap map[mssql.UniqueIdentifier]mssql.UniqueIdentifier,
) (mssql.UniqueIdentifier, error) {
	_ = entityTypeStr
	newUUID := mssql.UniqueIdentifier{}
	_ = newUUID.Scan(uuid.New().String())

	switch e := original.(type) {
	case *Line:
		newLine := Line{
			BaseModel:    createBaseFromOriginal(e.BaseModel, userName),
			AssemblyArea: e.AssemblyArea,
			Stations:     []Station{},
		}
		if err := tx.Create(&newLine).Error; err != nil {
			return newUUID, fmt.Errorf("failed to insert new Line: %w", err)
		}
		idMap[e.ID] = newLine.ID
		for i := range e.Stations {
			_, err := importCopiedEntityRecursive(tx, userName, &e.Stations[i], "station", newLine.ID, idMap)
			if err != nil {
				return newUUID, err
			}
		}
		return newLine.ID, nil

	case *Station:
		newStation := Station{
			BaseModel:      createBaseFromOriginal(e.BaseModel, userName),
			Description:    e.Description,
			StationType:    e.StationType,
			ParentID:       newParentID,
			Tools:          []Tool{},
			SequenceGroups: []SequenceGroup{},
		}
		if err := tx.Create(&newStation).Error; err != nil {
			return newUUID, fmt.Errorf("failed to insert new Station: %w", err)
		}
		idMap[e.ID] = newStation.ID
		for i := range e.Tools {
			_, err := importCopiedEntityRecursive(tx, userName, &e.Tools[i], "tool", newStation.ID, idMap)
			if err != nil {
				return newUUID, err
			}
		}
		return newStation.ID, nil

	case *Tool:
		newTool := Tool{
			BaseModel:             createBaseFromOriginal(e.BaseModel, userName),
			ToolClass:             e.ToolClass,
			ToolType:              e.ToolType,
			Description:           e.Description,
			IpAddressDevice:       e.IpAddressDevice,
			SPSPLCNameSPAService:  e.SPSPLCNameSPAService,
			SPSDBNoSend:           e.SPSDBNoSend,
			SPSDBNoReceive:        e.SPSDBNoReceive,
			SPSPreCheck:           e.SPSPreCheck,
			SPSAddressInSendDB:    e.SPSAddressInSendDB,
			SPSAddressInReceiveDB: e.SPSAddressInReceiveDB,
			ParentID:              newParentID,
			Operations:            []Operation{},
		}
		if err := tx.Create(&newTool).Error; err != nil {
			return newUUID, fmt.Errorf("failed to insert new Tool: %w", err)
		}
		idMap[e.ID] = newTool.ID
		for i := range e.Operations {
			_, err := importCopiedEntityRecursive(tx, userName, &e.Operations[i], "operation", newTool.ID, idMap)
			if err != nil {
				return newUUID, err
			}
		}
		return newTool.ID, nil

	case *Operation:
		newOp := Operation{
			BaseModel:         createBaseFromOriginal(e.BaseModel, userName),
			Description:       e.Description,
			DecisionCriteria:  e.DecisionCriteria,
			SerialOrParallel:  e.SerialOrParallel,
			SequenceGroup:     e.SequenceGroup,
			Sequence:          e.Sequence,
			AlwaysPerform:     e.AlwaysPerform,
			QGateRelevant:     e.QGateRelevant,
			Template:          e.Template,
			DecisionClass:     e.DecisionClass,
			SavingClass:       e.SavingClass,
			VerificationClass: e.VerificationClass,
			GenerationClass:   e.GenerationClass,
			ParentID:          newParentID,
			GroupID:           e.GroupID,
		}
		if err := tx.Create(&newOp).Error; err != nil {
			return newUUID, fmt.Errorf("failed to insert new Operation: %w", err)
		}
		idMap[e.ID] = newOp.ID
		return newOp.ID, nil

	default:
		return newUUID, fmt.Errorf("unsupported type in import: %T", original)
	}
}

// getHistoryModelInstance returns a new zero-value instance of a history model struct.
func getHistoryModelInstance(entityTypeStr string) (interface{}, error) {
	switch strings.ToLower(entityTypeStr) {
	case "line":
		return &LineHistory{}, nil
	case "station":
		return &StationHistory{}, nil
	case "tool":
		return &ToolHistory{}, nil
	case "operation":
		return &OperationHistory{}, nil
	default:
		return nil, fmt.Errorf("unknown entity type for history model: %s", entityTypeStr)
	}
}

func (c *Core) DeleteEntityByIDString(userName string, entityTypeStr string, entityIDStr string) error {
	if c.DB == nil {
		return errors.New("DB not initialized")
	}
	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return err
	}

	// Sonderfall: sequencegroup - nur die Entität selbst löschen, keine History, keine Kinder
	if strings.ToLower(entityTypeStr) == "sequencegroup" {
		modelInstance, err := getModelInstance(entityTypeStr)
		if err != nil {
			return err
		}
		if err := c.DB.First(modelInstance, "id = ?", entityIDmssql).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("no entity %s with ID %s found to delete", entityTypeStr, entityIDStr)
			}
			return fmt.Errorf("error finding entity %s with ID %s for delete: %w", entityTypeStr, entityIDStr, err)
		}
		result := c.DB.Delete(modelInstance)
		if result.Error != nil {
			return fmt.Errorf("error deleting %s with ID %s: %w", entityTypeStr, entityIDStr, result.Error)
		}
		if result.RowsAffected == 0 {
			return fmt.Errorf("no entity %s with ID %s actually deleted", entityTypeStr, entityIDStr)
		}
		return nil
	}

	modelInstance, err := getModelInstance(entityTypeStr)
	if err != nil {
		return err
	}

	if err := c.DB.First(modelInstance, "id = ?", entityIDmssql).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("no entity %s with ID %s found to delete", entityTypeStr, entityIDStr)
		}
		return fmt.Errorf("error finding entity %s with ID %s for delete: %w", entityTypeStr, entityIDStr, err)
	}

	// Before deleting, collect all child IDs that will be cascade-deleted.
	allIDsToDelete, err := c.collectAllChildIDs(strings.ToLower(entityTypeStr), entityIDmssql)
	if err != nil {
		return fmt.Errorf("failed to collect child IDs before delete: %w", err)
	}

	err = c.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Delete all history records for the entity and all its children.
		for entityType, ids := range allIDsToDelete {
			historyModel, err := getHistoryModelInstance(entityType)
			if err != nil {
				return err // Should not happen with validated types.
			}

			if len(ids) > 0 {
				if err := tx.Where("entity_id IN (?)", ids).Delete(historyModel).Error; err != nil {
					return fmt.Errorf("failed to delete history for %s: %w", entityType, err)
				}
			}
		}

		// 2. Delete the live record (cascades are handled by DB foreign key constraints).
		result := tx.Delete(modelInstance)
		if result.Error != nil {
			return fmt.Errorf("error deleting %s with ID %s: %w", entityTypeStr, entityIDStr, result.Error)
		}
		if result.RowsAffected == 0 {
			return fmt.Errorf("no entity %s with ID %s actually deleted", entityTypeStr, entityIDStr)
		}

		// 3. Log delete operations for all affected entities and update global timestamp.
		for entityType, ids := range allIDsToDelete {
			for _, idStr := range ids {
				entityID, parseErr := parseMSSQLUniqueIdentifierFromString(idStr)
				if parseErr != nil {
					return fmt.Errorf("error parsing entity ID %s for logging: %w", idStr, parseErr)
				}
				if logErr := updateGlobalLastUpdateTimestampAndLogChange(tx, entityID, entityType, OpTypeDelete, strPtr(userName), nil); logErr != nil {
					return fmt.Errorf("error logging delete for %s %s: %w", entityType, idStr, logErr)
				}
			}
		}
		return nil
	})
	return err
}

// GetEntityVersions retrieves all historical versions for a given entity, sorted from newest to oldest.
func (c *Core) GetEntityVersions(entityTypeStr string, entityIDStr string) (interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return nil, err
	}

	entityTypeNormalized := strings.ToLower(entityTypeStr)
	query := c.DB.Where("entity_id = ?", entityIDmssql).Order("version desc")

	switch entityTypeNormalized {
	case "line":
		var results []LineHistory
		err = query.Find(&results).Error
		return results, err
	case "station":
		var results []StationHistory
		err = query.Find(&results).Error
		return results, err
	case "tool":
		var results []ToolHistory
		err = query.Find(&results).Error
		return results, err
	case "operation":
		var results []OperationHistory
		err = query.Find(&results).Error
		return results, err
	default:
		return nil, fmt.Errorf("unsupported entity type for version history: %s", entityTypeStr)
	}
}

func (c *Core) cleanupBroker() {
	if c.DB == nil || c.queueName == "" || c.serviceName == "" {
		return
	}

	sqlDB, err := c.DB.DB()
	if err != nil {
		log.Printf("Warning: could not get SQL DB for cleanup: %v", err)
		return
	}

	stmts := []string{
		fmt.Sprintf(`IF EXISTS (SELECT * FROM sys.services WHERE name = '%s')
		 DROP SERVICE [%s];`, c.serviceName, c.serviceName),

		fmt.Sprintf(`IF EXISTS (SELECT * FROM sys.service_queues WHERE name = '%s')
		 DROP QUEUE [dbo].[%s];`, c.queueName, c.queueName),
	}

	for _, stmt := range stmts {
		if _, err := sqlDB.Exec(stmt); err != nil {
			log.Printf("Warning: Service Broker cleanup issue: %v", err)
		}
	}

	log.Printf("Service Broker cleanup completed for session: %s", c.queueName)
}

func (c *Core) cleanupBrokerWithDeadConnection(dsn string) {
	if c.queueName == "" || c.serviceName == "" {
		return
	}

	if dsn == "" {
		log.Printf("Warning: No DSN available for Service Broker cleanup")
		return
	}

	tempDB, err := sql.Open("sqlserver", dsn)
	if err != nil {
		log.Printf("Warning: could not create temp connection for Service Broker cleanup: %v", err)
		return
	}
	defer tempDB.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	stmts := []string{
		fmt.Sprintf(`IF EXISTS (SELECT * FROM sys.services WHERE name = '%s')
		 DROP SERVICE [%s];`, c.serviceName, c.serviceName),

		fmt.Sprintf(`IF EXISTS (SELECT * FROM sys.service_queues WHERE name = '%s')
		 DROP QUEUE [dbo].[%s];`, c.queueName, c.queueName),
	}

	for _, stmt := range stmts {
		if _, err := tempDB.ExecContext(ctx, stmt); err != nil {
			log.Printf("Warning: Service Broker cleanup issue with dead connection: %v", err)
		}
	}

	log.Printf("Service Broker cleanup with dead connection completed for session: %s", c.queueName)
}

func cleanupOrphanedResources(sqlDB *sql.DB) {
	stmt := `

	DECLARE @queueName NVARCHAR(256);
	DECLARE @serviceName NVARCHAR(256);
	DECLARE @isOrphaned BIT;
	
	DECLARE service_cursor CURSOR FOR
	  SELECT s.name as service_name, sq.name as queue_name
	  FROM sys.services s
	  JOIN sys.service_queues sq ON s.service_queue_id = sq.object_id
	  WHERE s.name LIKE 'DataChangeService_%';
	
	OPEN service_cursor;
	FETCH NEXT FROM service_cursor INTO @serviceName, @queueName;
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	  SET @isOrphaned = 0;
	  
	  BEGIN TRY
	    DECLARE @dummy_body VARBINARY(MAX);
	    SELECT TOP(1) @dummy_body = message_body 
	    FROM [dbo].[' + @queueName + ']
	    WITH (NOLOCK);
	  END TRY
	  BEGIN CATCH
	    IF ERROR_NUMBER() = 208
	      SET @isOrphaned = 1;
	  END CATCH
	  
	  FETCH NEXT FROM service_cursor INTO @serviceName, @queueName;
	END;
	
	CLOSE service_cursor;
	DEALLOCATE service_cursor;
	
	DECLARE orphan_queue_cursor CURSOR FOR
	  SELECT name FROM sys.service_queues 
	  WHERE name LIKE 'DataChangeQueue_%'
	  AND object_id NOT IN (SELECT service_queue_id FROM sys.services WHERE service_queue_id IS NOT NULL);
	
	OPEN orphan_queue_cursor;
	FETCH NEXT FROM orphan_queue_cursor INTO @queueName;
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	  BEGIN TRY
	    EXEC('DROP QUEUE [dbo].[' + @queueName + '];');
	    PRINT 'Cleaned up truly orphaned queue: ' + @queueName;
	  END TRY
	  BEGIN CATCH
	  END CATCH
	  
	  FETCH NEXT FROM orphan_queue_cursor INTO @queueName;
	END;
	
	CLOSE orphan_queue_cursor;
	DEALLOCATE orphan_queue_cursor;`

	if _, err := sqlDB.Exec(stmt); err != nil {
		log.Printf("Warning: Conservative orphaned resource cleanup issue: %v", err)
	}

	log.Println("Conservative orphaned Service Broker resources cleanup completed")
}
