package main

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/atotto/clipboard"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	mssql "github.com/microsoft/go-mssqldb"
	ws "github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

// Robust timestamp parsing helper for concurrency and DB compatibility
func parseTimestampFlexible(ts string) (time.Time, error) {
	// Try RFC3339Nano
	t, err := time.Parse(time.RFC3339Nano, ts)
	if err == nil {
		return t, nil
	}
	// Try RFC3339
	t, err = time.Parse(time.RFC3339, ts)
	if err == nil {
		return t, nil
	}
	// Try SQL Server datetime2 (no T, no timezone)
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
	DB             *gorm.DB // Jede Instanz hat ihre eigene Verbindung
	queueName      string   // Unique queue name for this instance
	serviceName    string   // Unique service name for this instance
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

func setupBroker(DB *gorm.DB, dbName string) (string, string, error) {
	sqlDB, err := DB.DB()
	if err != nil {
		return "", "", err
	}

	// Generate unique session ID for tracking
	sessionID := uuid.New().String()
	queueName := fmt.Sprintf("DataChangeQueue_%s", strings.ReplaceAll(sessionID, "-", ""))
	serviceName := fmt.Sprintf("DataChangeService_%s", strings.ReplaceAll(sessionID, "-", ""))

	// First, clean up any orphaned Service Broker resources from previous runs
	cleanupOrphanedResources(sqlDB)

	stmts := []string{
		// Enable Service Broker on the database (only if not already enabled)
		fmt.Sprintf(`IF (SELECT is_broker_enabled FROM sys.databases WHERE name = '%s') = 0
		 BEGIN
		   ALTER DATABASE [%s] SET ENABLE_BROKER;
		 END;`, dbName, dbName),

		// Create message type if not exists
		`IF NOT EXISTS (SELECT * FROM sys.service_message_types WHERE name = 'DataChanged')
		 CREATE MESSAGE TYPE [DataChanged] VALIDATION = NONE;`,

		// Create contract if not exists
		`IF NOT EXISTS (SELECT * FROM sys.service_contracts WHERE name = 'DataChangedContract')
		 CREATE CONTRACT [DataChangedContract] ([DataChanged] SENT BY INITIATOR);`,

		// Create unique queue for this session
		fmt.Sprintf(`IF NOT EXISTS (SELECT * FROM sys.service_queues WHERE name = '%s')
		 CREATE QUEUE [dbo].[%s];`, queueName, queueName),

		// Create unique service for this session
		fmt.Sprintf(`IF NOT EXISTS (SELECT * FROM sys.services WHERE name = '%s')
		 CREATE SERVICE [%s] ON QUEUE [dbo].[%s] ([DataChangedContract]);`,
			serviceName, serviceName, queueName),

		// Create the trigger only if it doesn't exist (don't drop and recreate)
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
			// Don't fail for broker already enabled
			if !strings.Contains(err.Error(), "already enabled") {
				log.Printf("Warning: Service Broker setup issue: %v", err)
			}
		}
	}
	log.Printf("Service Broker setup completed for session: %s", sessionID)
	return queueName, serviceName, nil
}

func (c *Core) listenForChanges(ctx context.Context, sqlDB *sql.DB) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("PANIC in listenForChanges: %v", r)
		}
	}()

	log.Printf("Starting Service Broker listener (session: %s)", c.queueName)

	// Add a connection health check ticker
	healthCheckTicker := time.NewTicker(15 * time.Second)
	defer healthCheckTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Listener stopped (context canceled)")
			return
		case <-healthCheckTicker.C:
			// Proactive connection health check
			if err := c.checkConnectionHealth(ctx, sqlDB); err != nil {
				log.Printf("Connection health check failed: %v", err)
				c.cleanupBrokerWithDeadConnection()
				ws.EventsEmit(ctx, "database:connection_lost", err.Error())
				log.Printf("Listener exiting due to failed health check (session: %s)", c.queueName)
				return
			}
		default:
		}

		// Use WAITFOR RECEIVE to block until a message arrives (reduced timeout for faster detection)
		query := fmt.Sprintf(`
			WAITFOR (
				RECEIVE TOP(1) message_body 
				FROM [dbo].[%s]
			), TIMEOUT 15000;
		`, c.queueName)

		ctx_timeout, cancel := context.WithTimeout(ctx, 20*time.Second)
		row := sqlDB.QueryRowContext(ctx_timeout, query)

		var messageBody sql.NullString
		err := row.Scan(&messageBody)
		cancel()

		if err != nil {
			if ctx.Err() != nil {
				log.Println("Listener stopped due to context cancellation")
				return
			} // Check for connection errors
			if strings.Contains(err.Error(), "connection") ||
				strings.Contains(err.Error(), "network") ||
				strings.Contains(err.Error(), "timeout") ||
				strings.Contains(err.Error(), "database is closed") ||
				strings.Contains(err.Error(), "transport") {
				log.Printf("Database connection lost: %v", err)

				// Clean up Service Broker resources for this dead connection
				// We do this here to prevent stale resources from interfering
				c.cleanupBrokerWithDeadConnection()

				ws.EventsEmit(ctx, "database:connection_lost", err.Error())

				// Exit the listener - let InitDB restart everything cleanly
				log.Printf("Listener exiting due to connection loss (session: %s)", c.queueName)
				return
			}

			// Handle timeout (no messages) - this is normal, continue listening
			if strings.Contains(err.Error(), "no rows") ||
				strings.Contains(err.Error(), "WAITFOR") ||
				strings.Contains(err.Error(), "timeout") {
				// No messages received within timeout period - continue listening
				continue
			}

			log.Printf("Service Broker listener error: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		// If we reach here, a message was received (database changed!)
		if messageBody.Valid {
			log.Printf("Database change notification received: %s", messageBody.String)
			ws.EventsEmit(ctx, "database:changed", time.Now())
		}
	}
}

const GlobalMetadataKey = "global_state"
const OpTypeUpdate = "UPDATE"
const OpTypeDelete = "DELETE"
const OpTypeSystemEvent = "SYSTEM_EVENT"

func (c *Core) CheckEnvInExeDir() bool {
	exePath, err := os.Executable()
	if err != nil {
		return false
	}
	envPath := filepath.Join(filepath.Dir(exePath), ".env")
	_, err = os.Stat(envPath)
	return err == nil
}

type DSNParams struct {
	User                   string
	Password               string
	Host                   string
	Port                   string
	Database               string
	Encrypt                string
	TrustServerCertificate string
}

func (c *Core) ParseDSNFromEnv() (*DSNParams, error) {
	dsn := os.Getenv("MSSQL_DSN")
	if dsn == "" {
		return nil, errors.New("MSSQL_DSN not set in environment")
	}
	u, err := url.Parse(dsn)
	if err != nil {
		return nil, err
	}
	user := ""
	pass := ""
	if u.User != nil {
		user = u.User.Username()
		pass, _ = u.User.Password()
	}
	host, port, _ := net.SplitHostPort(u.Host)
	q := u.Query()
	return &DSNParams{
		User:                   user,
		Password:               pass,
		Host:                   host,
		Port:                   port,
		Database:               q.Get("database"),
		Encrypt:                q.Get("encrypt"),
		TrustServerCertificate: q.Get("trustservercertificate"),
	}, nil
}

func loadConfiguration() {
	exePath, err := os.Executable()
	if err == nil {
		envPath := filepath.Join(filepath.Dir(exePath), ".env")
		errLoad := godotenv.Load(envPath)
		if errLoad == nil {
			log.Printf("Successfully loaded .env file from: %s", envPath)
			return
		}
		if !os.IsNotExist(errLoad) {
			log.Printf("Warning: Error loading .env file from %s: %v", envPath, errLoad)
		} else {
			log.Printf("Info: No .env file found at %s.", envPath)
		}
	} else {
		log.Printf("Warning: Could not get executable path: %v. Will try to load .env from current working directory.", err)
	}
	err = godotenv.Load()
	if err != nil {
		if os.IsNotExist(err) {
			log.Println("Info: No .env file found in current working directory. Relying on OS environment variables or awaiting configuration.")
		} else {
			log.Printf("Warning: Error loading .env file from current working directory: %v", err)
		}
	} else {
		log.Println("Successfully loaded .env file from current working directory.")
	}
}
func (c *Core) InitDB() string {
	// Stop any existing listener
	if c.listenerCancel != nil {
		c.listenerCancel()
		c.listenerCancel = nil
		// Give the listener time to exit cleanly
		time.Sleep(100 * time.Millisecond)
	}

	// Clean up existing Service Broker resources before closing DB
	c.cleanupBroker()

	// Also try cleanup with a fresh connection in case the current one is dead
	if c.queueName != "" || c.serviceName != "" {
		c.cleanupBrokerWithDeadConnection()
	}

	// Close existing DB connection
	if c.DB != nil {
		sqlDB, err := c.DB.DB()
		if err == nil {
			sqlDB.Close()
		}
		c.DB = nil
	}

	// Clear queue and service names
	c.queueName = ""
	c.serviceName = ""
	loadConfiguration()
	dsn := os.Getenv("MSSQL_DSN")
	if dsn == "" {
		return "InitError"
	}
	gormLogLevelStr := os.Getenv("GORM_LOGGER_LEVEL")
	gormLogLevel := logger.Warn
	switch strings.ToLower(gormLogLevelStr) {
	case "silent":
		gormLogLevel = logger.Silent
	case "error":
		gormLogLevel = logger.Error
	case "info":
		gormLogLevel = logger.Info
	}
	var err error
	c.DB, err = gorm.Open(sqlserver.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(gormLogLevel)})
	if err != nil {
		return "InitError"
	}
	err = c.DB.AutoMigrate(&Line{}, &Station{}, &Tool{}, &Operation{}, &Version{}, &LineHistory{}, &StationHistory{}, &ToolHistory{}, &OperationHistory{}, &AppMetadata{}, &EntityChangeLog{})
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
	c.queueName = queueName     // Store queue name for this instance
	c.serviceName = serviceName // Store service name for this instance
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
	go c.listenForChanges(listenerCtx, sqlDB) // Pass Core instance to use queueName

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
func (c *Core) ConfigureAndSaveDSN(host, portStr, dbname, user, password, encrypt, trustServerCertificate string) error {
	if host == "" || portStr == "" || dbname == "" || user == "" {
		return errors.New("host, port, database name, and user are required fields")
	}
	if _, err := strconv.Atoi(portStr); err != nil {
		return fmt.Errorf("invalid port number: %s", portStr)
	}
	encryptLower := strings.ToLower(encrypt)
	if encryptLower == "" {
		encryptLower = "disable"
	} else if encryptLower != "true" && encryptLower != "false" && encryptLower != "disable" {
		return errors.New("invalid encrypt option, must be true, false, or disable")
	}

	trustLower := strings.ToLower(trustServerCertificate)
	trustParam := ""
	if trustLower == "true" {
		trustParam = "&trustservercertificate=true"
	}

	dsn := fmt.Sprintf(
		"sqlserver://%s:%s@%s:%s?database=%s&encrypt=%s%s&connection+timeout=10&dial+timeout=5",
		user, password, host, portStr, dbname, encryptLower, trustParam,
	)

	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("could not get executable path to save .env file: %w", err)
	}
	envFilePath := filepath.Join(filepath.Dir(exePath), ".env")
	file, err := os.OpenFile(envFilePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("failed to open/create .env file at %s: %w", envFilePath, err)
	}
	defer file.Close()
	writer := bufio.NewWriter(file)
	_, err = writer.WriteString(fmt.Sprintf("MSSQL_DSN=%s\n", dsn))
	if err != nil {
		return fmt.Errorf("failed to write MSSQL_DSN to .env file: %w", err)
	}
	if err = writer.Flush(); err != nil {
		return fmt.Errorf("failed to flush .env file writer: %w", err)
	}
	log.Printf(".env file successfully created/updated at: %s", envFilePath)
	return nil
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
func updateGlobalLastUpdateTimestampAndLogChange(tx *gorm.DB, entityID mssql.UniqueIdentifier, entityType string, operationType string, userID *string) error {
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
		changeLog := EntityChangeLog{EntityID: entityID, EntityType: logEntityType, OperationType: operationType, ChangeTime: now, ChangedByUserID: userID}
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
	NewGlobalLastUpdatedAt string              `json:"newGlobalLastUpdatedAt"`
	UpdatedEntities        map[string][]string `json:"updatedEntities"`
	DeletedEntities        map[string][]string `json:"deletedEntities"`
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
	response := &ChangeResponse{NewGlobalLastUpdatedAt: currentGlobalTsStr, UpdatedEntities: make(map[string][]string), DeletedEntities: make(map[string][]string)}
	if currentGlobalTime.After(clientLastKnownTime) {
		var logs []EntityChangeLog
		if err := c.DB.Where("change_time > ?", clientLastKnownTime).Order("change_time asc").Find(&logs).Error; err != nil {
			return nil, fmt.Errorf("failed to fetch change logs: %w", err)
		}
		processedUpdatedIDs := make(map[string]bool)
		for _, lg := range logs {
			idStr := lg.EntityID.String()
			if lg.OperationType == OpTypeSystemEvent {
				if _, ok := response.UpdatedEntities["system_event"]; !ok {
					response.UpdatedEntities["system_event"] = []string{}
				}
				response.UpdatedEntities["system_event"] = append(response.UpdatedEntities["system_event"], fmt.Sprintf("%s:%s", lg.EntityType, idStr))
			} else if lg.OperationType == OpTypeDelete {
				response.DeletedEntities[lg.EntityType] = append(response.DeletedEntities[lg.EntityType], idStr)
				delete(processedUpdatedIDs, lg.EntityType+"_"+idStr)
			} else if lg.OperationType == OpTypeUpdate && !processedUpdatedIDs[lg.EntityType+"_"+idStr] {
				response.UpdatedEntities[lg.EntityType] = append(response.UpdatedEntities[lg.EntityType], idStr)
				processedUpdatedIDs[lg.EntityType+"_"+idStr] = true
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
	case "linehistory":
		return &LineHistory{}, nil
	case "stationhistory":
		return &StationHistory{}, nil
	case "toolhistory":
		return &ToolHistory{}, nil
	case "operationhistory":
		return &OperationHistory{}, nil
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
	modelToUpdate, err := getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	var finalModelInstance interface{}
	err = c.DB.Transaction(func(tx *gorm.DB) error {
		var dbEntityForCheck interface{}
		dbEntityForCheck, err = getModelInstance(entityTypeStr)
		if err != nil {
			return err
		}
		if errCheck := tx.Where("id = ?", entityIDmssql).Take(dbEntityForCheck).Error; errCheck != nil {
			if errors.Is(errCheck, gorm.ErrRecordNotFound) {
				return errors.New("record not found or already deleted")
			}
			return fmt.Errorf("error loading entity for update check: %w", errCheck)
		}
		var currentDBUpdatedAt time.Time
		switch strings.ToLower(entityTypeStr) {
		case "line":
			var m Line
			if err := tx.Where("id = ?", entityIDmssql).Take(&m).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.New("record not found or already deleted")
				}
				return fmt.Errorf("error loading entity for update check: %w", err)
			}
		case "station":
			var m Station
			if err := tx.Where("id = ?", entityIDmssql).Take(&m).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.New("record not found or already deleted")
				}
				return fmt.Errorf("error loading entity for update check: %w", err)
			}
		case "tool":
			var m Tool
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
		default:
			return fmt.Errorf("unknown type for timestamp extraction: %s", entityTypeStr)
		}
		// Hole den aktuellen globalen Zeitstempel wie der Client
		currentGlobalTsStr, err := c.GetGlobalLastUpdateTimestamp()
		if err != nil {
			return fmt.Errorf("failed to get global last update timestamp: %w", err)
		}
		currentDBUpdatedAt, err = parseTimestampFlexible(currentGlobalTsStr)
		if err != nil {
			return fmt.Errorf("failed to parse global last update timestamp: %w", err)
		}
		if currentDBUpdatedAt.UTC().Before(lastKnownUpdatedAt.UTC()) {
			log.Printf("[Concurrency] Conflict detected: DB UpdatedAt=%s | Client UpdatedAt=%s", currentDBUpdatedAt.UTC().Format(time.RFC3339Nano), lastKnownUpdatedAt.UTC().Format(time.RFC3339Nano))
			return errors.New("conflict: record was modified by another user")
		}
		gormUpdates := make(map[string]interface{})
		for k, v := range updatesMapStr {
			gormUpdates[k] = strPtr(v)
		}
		gormUpdates["updated_by"] = strPtr(userName)
		gormUpdates["updated_at"] = time.Now()
		if errUpdate := tx.Model(modelToUpdate).Where("id = ?", entityIDmssql).Updates(gormUpdates).Error; errUpdate != nil {
			return fmt.Errorf("error updating DB: %w", errUpdate)
		}
		reloadedEntityWithinTx, _ := getModelInstance(entityTypeStr)
		if errLoad := tx.First(reloadedEntityWithinTx, "id = ?", entityIDmssql).Error; errLoad != nil {
			return fmt.Errorf("error reloading entity after update within tx: %w", errLoad)
		}
		finalModelInstance = reloadedEntityWithinTx
		return updateGlobalLastUpdateTimestampAndLogChange(tx, entityIDmssql, strings.ToLower(entityTypeStr), OpTypeUpdate, strPtr(userName))
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
func (c *Core) GetVersionedEntityDetails(versionIDStr string, entityTypeStr string, entityOriginalIDStr string) (interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	versionIDmssql, err := parseMSSQLUniqueIdentifierFromString(versionIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid versionID: %w", err)
	}
	entityOriginalIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityOriginalIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid entityOriginalID: %w", err)
	}
	historyModelName := strings.ToLower(entityTypeStr) + "history"
	historyInstance, err := getModelInstance(historyModelName)
	if err != nil {
		return nil, fmt.Errorf("could not get history model instance for %s: %w", entityTypeStr, err)
	}
	if err := c.DB.Where("version_id = ? AND id = ?", versionIDmssql, entityOriginalIDmssql).Take(historyInstance).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("%s with original ID %s in version %s not found", entityTypeStr, entityOriginalIDStr, versionIDStr)
		}
		return nil, fmt.Errorf("error fetching versioned %s (ID: %s, Version: %s): %w", entityTypeStr, entityOriginalIDStr, versionIDStr, err)
	}
	return historyInstance, nil
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
	default:
		return nil, fmt.Errorf("GetAllEntities not implemented for type: %s", entityTypeStr)
	}
	return results, nil
}
func (c *Core) GetAllVersionedEntities(versionIDStr string, entityTypeStr string, parentIDStr_optional string) ([]interface{}, error) {
	if c.DB == nil {
		return nil, errors.New("DB not initialized")
	}
	versionIDmssql, err := parseMSSQLUniqueIdentifierFromString(versionIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid versionID: %w", err)
	}
	historyModelName := strings.ToLower(entityTypeStr) + "history"
	historyInstance, err := getModelInstance(historyModelName)
	if err != nil {
		return nil, err
	}
	var results []interface{}
	query := c.DB.Model(historyInstance).Where("version_id = ?", versionIDmssql).Order("created_at asc")
	if parentIDStr_optional != "" {
		parentIDmssql, err := parseMSSQLUniqueIdentifierFromString(parentIDStr_optional)
		if err != nil {
			return nil, fmt.Errorf("invalid parentID for GetAllVersionedEntities: %w", err)
		}
		query = query.Where("parent_id = ?", parentIDmssql)
	} else {
		if strings.ToLower(entityTypeStr) != "line" {
			return nil, errors.New("ParentID is required for non-line entities in GetAllVersionedEntities unless fetching all lines of a version")
		}
	}
	switch strings.ToLower(entityTypeStr) {
	case "line":
		var items []LineHistory
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "station":
		var items []StationHistory
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "tool":
		var items []ToolHistory
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "operation":
		var items []OperationHistory
		if err := query.Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			results = append(results, &items[i])
		}
	default:
		return nil, fmt.Errorf("GetAllVersionedEntities not implemented for type: %s", entityTypeStr)
	}
	return results, nil
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
		txDB = txDB.Preload("Stations.Tools.Operations")
	case "station":
		txDB = txDB.Preload("Tools.Operations").Preload("Line")
	case "tool":
		txDB = txDB.Preload("Operations").Preload("Station.Line")
	case "operation":
		txDB = txDB.Preload("Tool.Station.Line")
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

/*
	func (c *Core) ExportVersionedEntityHierarchyToJSON(versionIDStr string, rootEntityTypeStr string, rootEntityOriginalIDStr string, filePath string) error {
		if DB == nil {
			return errors.New("DB not initialized")
		}
		if filePath == "" {
			return errors.New("export filePath is empty")
		}
		hierarchyData, err := c.GetVersionedEntityHierarchy(versionIDStr, rootEntityTypeStr, rootEntityOriginalIDStr)
		if err != nil {
			return fmt.Errorf("error loading versioned entity hierarchy for export: %w", err)
		}
		jsonData, err := json.MarshalIndent(hierarchyData, "", "  ")
		if err != nil {
			return fmt.Errorf("error converting versioned data to JSON: %w", err)
		}
		err = os.WriteFile(filePath, jsonData, 0644)
		if err != nil {
			return fmt.Errorf("error writing versioned JSON file to '%s': %w", filePath, err)
		}
		log.Printf("Versioned hierarchy (Version: %s) successfully exported to '%s'.", versionIDStr, filePath)
		return nil
	}
*/
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
		if errTimestamp := updateGlobalLastUpdateTimestampAndLogChange(tx, emptyMsSQLID, "system", OpTypeSystemEvent, strPtr(importingUserName)); errTimestamp != nil {
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

	// Hierarchisches Preloading je nach Entity-Typ
	var tx *gorm.DB
	switch entityTypeStr {
	case "line":
		tx = c.DB.Preload("Stations.Tools.Operations")
	case "station":
		tx = c.DB.Preload("Tools.Operations")
	case "tool":
		tx = c.DB.Preload("Operations")
	case "operation":
		tx = c.DB // keine Preloads nötig
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

	if strings.ToLower(actualEntityType) != strings.ToLower(expectedEntityType) {
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

	return updateGlobalLastUpdateTimestampAndLogChange(tx, mssql.UniqueIdentifier{}, "system", OpTypeSystemEvent, strPtr(userName))
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
		Name:    original.Name,
		Comment: original.Comment,

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
			BaseModel:        createBaseFromOriginal(e.BaseModel, userName),
			Description:      e.Description,
			StationType:      e.StationType,
			SerialOrParallel: e.SerialOrParallel,
			ParentID:         newParentID,
			Tools:            []Tool{},
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
			BaseModel:          createBaseFromOriginal(e.BaseModel, userName),
			Description:        e.Description,
			DecisionCriteria:   e.DecisionCriteria,
			SequenceGroup:      e.SequenceGroup,
			Sequence:           e.Sequence,
			AlwaysPerform:      e.AlwaysPerform,
			QGateRelevant:      e.QGateRelevant,
			Template:           e.Template,
			DecisionClass:      e.DecisionClass,
			SavingClass:        e.SavingClass,
			VerificationClass:  e.VerificationClass,
			GenerationClass:    e.GenerationClass,
			OperationDecisions: e.OperationDecisions,
			ParentID:           newParentID,
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

func (c *Core) DeleteEntityByIDString(userName string, entityTypeStr string, entityIDStr string) error {
	if c.DB == nil {
		return errors.New("DB not initialized")
	}
	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return err
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
	err = c.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Delete(modelInstance)
		if result.Error != nil {
			return fmt.Errorf("error deleting %s with ID %s: %w", entityTypeStr, entityIDStr, result.Error)
		}
		if result.RowsAffected == 0 {
			return fmt.Errorf("no entity %s with ID %s actually deleted", entityTypeStr, entityIDStr)
		}
		var loggedEntityID mssql.UniqueIdentifier
		switch e := modelInstance.(type) {
		case *Line:
			loggedEntityID = e.ID
		case *Station:
			loggedEntityID = e.ID
		case *Tool:
			loggedEntityID = e.ID
		case *Operation:
			loggedEntityID = e.ID
		default:
			return errors.New("could not determine ID for logging delete operation")
		}
		return updateGlobalLastUpdateTimestampAndLogChange(tx, loggedEntityID, strings.ToLower(entityTypeStr), OpTypeDelete, strPtr(userName))
	})
	return err
}

// cleanupBroker removes the queue and service for this instance
func (c *Core) cleanupBroker() {
	if c.DB == nil || c.queueName == "" || c.serviceName == "" {
		return
	}

	sqlDB, err := c.DB.DB()
	if err != nil {
		log.Printf("Warning: could not get SQL DB for cleanup: %v", err)
		return
	}

	// Clean up this instance's Service Broker resources
	stmts := []string{
		// Drop the service first
		fmt.Sprintf(`IF EXISTS (SELECT * FROM sys.services WHERE name = '%s')
		 DROP SERVICE [%s];`, c.serviceName, c.serviceName),

		// Drop the queue
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

// cleanupBrokerWithDeadConnection attempts cleanup when the main connection is dead
// This uses a new connection to avoid dependency on the failed connection
func (c *Core) cleanupBrokerWithDeadConnection() {
	if c.queueName == "" || c.serviceName == "" {
		return
	}

	// Try to create a new connection for cleanup
	dsn := os.Getenv("MSSQL_DSN")
	if dsn == "" {
		log.Printf("Warning: No DSN available for Service Broker cleanup")
		return
	}

	// Create a temporary connection just for cleanup
	tempDB, err := sql.Open("sqlserver", dsn)
	if err != nil {
		log.Printf("Warning: could not create temp connection for Service Broker cleanup: %v", err)
		return
	}
	defer tempDB.Close()

	// Set a short timeout for cleanup operations
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Clean up this instance's Service Broker resources
	stmts := []string{
		// Drop the service first
		fmt.Sprintf(`IF EXISTS (SELECT * FROM sys.services WHERE name = '%s')
		 DROP SERVICE [%s];`, c.serviceName, c.serviceName),

		// Drop the queue
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

// cleanupOrphanedResources removes old Service Broker resources that might be left from crashed instances
func cleanupOrphanedResources(sqlDB *sql.DB) {
	// Clean up orphaned services and queues older than 30 minutes (was 5 minutes, too aggressive)
	// This helps prevent accumulation of resources from crashed instances
	stmts := []string{
		// Get and clean up old services - more conservative approach
		`DECLARE @serviceName NVARCHAR(256);
		 DECLARE service_cursor CURSOR FOR
		   SELECT name FROM sys.services 
		   WHERE name LIKE 'DataChangeService_%'
		   AND create_date < DATEADD(MINUTE, -30, GETDATE());
		 
		 OPEN service_cursor;
		 FETCH NEXT FROM service_cursor INTO @serviceName;
		 
		 WHILE @@FETCH_STATUS = 0
		 BEGIN
		   BEGIN TRY
		     EXEC('DROP SERVICE [' + @serviceName + '];');
		     PRINT 'Cleaned up old service: ' + @serviceName;
		   END TRY
		   BEGIN CATCH
		     -- Ignore errors
		   END CATCH
		   
		   FETCH NEXT FROM service_cursor INTO @serviceName;
		 END;
		 
		 CLOSE service_cursor;
		 DEALLOCATE service_cursor;`,

		// Clean up orphaned queues - only those not associated with any service
		`DECLARE @queueName NVARCHAR(256);
		 DECLARE queue_cursor CURSOR FOR
		   SELECT name FROM sys.service_queues 
		   WHERE name LIKE 'DataChangeQueue_%'
		   AND object_id NOT IN (SELECT service_queue_id FROM sys.services WHERE service_queue_id IS NOT NULL);
		 
		 OPEN queue_cursor;
		 FETCH NEXT FROM queue_cursor INTO @queueName;
		 
		 WHILE @@FETCH_STATUS = 0
		 BEGIN
		   BEGIN TRY
		     EXEC('DROP QUEUE [dbo].[' + @queueName + '];');
		     PRINT 'Cleaned up orphaned queue: ' + @queueName;
		   END TRY
		   BEGIN CATCH
		     -- Ignore errors
		   END CATCH
		   
		   FETCH NEXT FROM queue_cursor INTO @queueName;
		 END;
		 
		 CLOSE queue_cursor;
		 DEALLOCATE queue_cursor;`,
	}

	for _, stmt := range stmts {
		if _, err := sqlDB.Exec(stmt); err != nil {
			log.Printf("Warning: Orphaned resource cleanup issue: %v", err)
		}
	}

	log.Println("Orphaned Service Broker resources cleanup completed")
}

func (c *Core) checkConnectionHealth(ctx context.Context, sqlDB *sql.DB) error {
	healthCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	// Simple ping to detect connection issues
	if err := sqlDB.PingContext(healthCtx); err != nil {
		return fmt.Errorf("connection ping failed: %w", err)
	}

	// Quick query to verify Service Broker queue accessibility
	query := fmt.Sprintf("SELECT COUNT(*) FROM sys.service_queues WHERE name = '%s'", c.queueName)
	var count int
	if err := sqlDB.QueryRowContext(healthCtx, query).Scan(&count); err != nil {
		return fmt.Errorf("service broker health check failed: %w", err)
	}

	if count == 0 {
		return fmt.Errorf("service broker queue %s no longer exists", c.queueName)
	}

	return nil
}
