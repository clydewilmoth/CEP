package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"os/user"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	mssql "github.com/microsoft/go-mssqldb"
	ws "github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

type Core struct {
	ctx context.Context
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

var DB *gorm.DB

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
	DB, err = gorm.Open(sqlserver.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(gormLogLevel)})
	if err != nil {
		return "InitError"
	}
	err = DB.AutoMigrate(&Line{}, &Station{}, &Tool{}, &Operation{}, &Version{}, &LineHistory{}, &StationHistory{}, &ToolHistory{}, &OperationHistory{}, &AppMetadata{}, &EntityChangeLog{})
	if err != nil {
		return "InitError"
	}
	ensureAppMetadataExists(DB)
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
		"sqlserver://%s:%s@%s:%s?database=%s&encrypt=%s%s",
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
	if DB == nil {
		return "", errors.New("DB not initialized")
	}
	var meta AppMetadata
	if err := DB.Where("config_key = ?", GlobalMetadataKey).Take(&meta).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			nowTime := time.Now()
			go DB.Create(&AppMetadata{ConfigKey: GlobalMetadataKey, LastUpdate: nowTime})
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
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	clientLastKnownTime, err := time.Parse(time.RFC3339Nano, clientLastKnownTimestampStr)
	if err != nil {
		clientLastKnownTime, err = time.Parse(time.RFC3339, clientLastKnownTimestampStr)
		if err != nil {
			return nil, fmt.Errorf("invalid clientLastKnownTimestampStr format: %w", err)
		}
	}
	currentGlobalTsStr, err := c.GetGlobalLastUpdateTimestamp()
	if err != nil {
		return nil, fmt.Errorf("failed to get current global update timestamp: %w", err)
	}
	currentGlobalTime, _ := time.Parse(time.RFC3339Nano, currentGlobalTsStr)
	response := &ChangeResponse{NewGlobalLastUpdatedAt: currentGlobalTsStr, UpdatedEntities: make(map[string][]string), DeletedEntities: make(map[string][]string)}
	if currentGlobalTime.After(clientLastKnownTime) {
		var logs []EntityChangeLog
		if err := DB.Where("change_time > ?", clientLastKnownTime).Order("change_time asc").Find(&logs).Error; err != nil {
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
	if DB == nil {
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
	err = DB.Transaction(func(tx *gorm.DB) error {
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
	if errReload := DB.First(reloadedEntity, "id = ?", createdEntityID).Error; errReload != nil {
		return nil, fmt.Errorf("error reloading entity (ID: %s) after create: %w", createdEntityID.String(), errReload)
	}
	return reloadedEntity, nil
}

func (c *Core) UpdateEntityFieldsString(userName string, entityTypeStr string, entityIDStr string, lastKnownUpdatedAtStr string, updatesMapStr map[string]string) (interface{}, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	if userName == "" {
		return nil, errors.New("userName is required for update")
	}
	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return nil, err
	}
	lastKnownUpdatedAt, err := time.Parse(time.RFC3339Nano, lastKnownUpdatedAtStr)
	if err != nil {
		lastKnownUpdatedAt, err = time.Parse(time.RFC3339, lastKnownUpdatedAtStr)
		if err != nil {
			return nil, fmt.Errorf("invalid updated_at format ('%s'): %w", lastKnownUpdatedAtStr, err)
		}
	}
	modelToUpdate, err := getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	var finalModelInstance interface{}
	err = DB.Transaction(func(tx *gorm.DB) error {
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
		switch m := dbEntityForCheck.(type) {
		case *Line:
			currentDBUpdatedAt = m.UpdatedAt
		case *Station:
			currentDBUpdatedAt = m.UpdatedAt
		case *Tool:
			currentDBUpdatedAt = m.UpdatedAt
		case *Operation:
			currentDBUpdatedAt = m.UpdatedAt
		default:
			return fmt.Errorf("unknown type for timestamp extraction: %T", m)
		}
		if !currentDBUpdatedAt.Truncate(time.Millisecond).Equal(lastKnownUpdatedAt.Truncate(time.Millisecond)) {
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
	if DB == nil {
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
	if err := DB.Where("id = ?", entityIDmssql).Take(modelInstance).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("entity type %s with ID %s not found", entityTypeStr, entityIDStr)
		}
		return nil, fmt.Errorf("error loading entity type %s with ID %s: %w", entityTypeStr, entityIDStr, err)
	}
	return modelInstance, nil
}
func (c *Core) GetVersionedEntityDetails(versionIDStr string, entityTypeStr string, entityOriginalIDStr string) (interface{}, error) {
	if DB == nil {
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
	if err := DB.Where("version_id = ? AND id = ?", versionIDmssql, entityOriginalIDmssql).Take(historyInstance).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("%s with original ID %s in version %s not found", entityTypeStr, entityOriginalIDStr, versionIDStr)
		}
		return nil, fmt.Errorf("error fetching versioned %s (ID: %s, Version: %s): %w", entityTypeStr, entityOriginalIDStr, versionIDStr, err)
	}
	return historyInstance, nil
}
func (c *Core) GetAllEntities(entityTypeStr string, parentIDStr_optional string) ([]interface{}, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	modelInstance, err := getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	var results []interface{}
	query := DB.Model(modelInstance).Order("created_at asc")
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
	if DB == nil {
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
	query := DB.Model(historyInstance).Where("version_id = ?", versionIDmssql).Order("created_at asc")
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
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	data, err := internalGetEntityHierarchy(entityTypeStr, entityIDStr)
	if err != nil {
		return nil, err
	}
	globalTs, tsErr := c.GetGlobalLastUpdateTimestamp()
	if tsErr != nil {
		log.Printf("Warning: could not load global update timestamp: %v", tsErr)
	}
	return &HierarchyResponse{Data: data, GlobalLastUpdatedAt: globalTs}, nil
}
func internalGetEntityHierarchy(entityTypeStr string, entityIDStr string) (interface{}, error) {
	entityIDmssql, err := parseMSSQLUniqueIdentifierFromString(entityIDStr)
	if err != nil {
		return nil, err
	}
	modelInstance, err := getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	txDB := DB
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
func (c *Core) DeleteEntityByIDString(userName string, entityTypeStr string, entityIDStr string) error {
	if DB == nil {
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
	if err := DB.First(modelInstance, "id = ?", entityIDmssql).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("no entity %s with ID %s found to delete", entityTypeStr, entityIDStr)
		}
		return fmt.Errorf("error finding entity %s with ID %s for delete: %w", entityTypeStr, entityIDStr, err)
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
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
func (c *Core) CreateSnapshot(userName string, description string) (*Version, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	newVersionEntry := Version{CreatedBy: strPtr(userName), Description: strPtr(description)}
	var createdVersion Version
	pkGeneratorFuncSQL := "NEWID()"
	var newVersionIDmssql mssql.UniqueIdentifier
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&newVersionEntry).Error; err != nil {
			return fmt.Errorf("error creating Version entry: %w", err)
		}
		newVersionIDmssql = newVersionEntry.VersionID
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO line_histories (history_pk, version_id, id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, created_at, updated_at, created_by, updated_by, name, description FROM lines`, pkGeneratorFuncSQL), newVersionIDmssql).Error; err != nil {
			return fmt.Errorf("error copying Lines: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO station_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM stations`, pkGeneratorFuncSQL), newVersionIDmssql).Error; err != nil {
			return fmt.Errorf("error copying Stations: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO tool_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM tools`, pkGeneratorFuncSQL), newVersionIDmssql).Error; err != nil {
			return fmt.Errorf("error copying Tools: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO operation_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM operations`, pkGeneratorFuncSQL), newVersionIDmssql).Error; err != nil {
			return fmt.Errorf("error copying Operations: %w", err)
		}
		if err := tx.First(&createdVersion, "version_id = ?", newVersionIDmssql).Error; err != nil {
			return fmt.Errorf("error reloading Version entry: %w", err)
		}
		return updateGlobalLastUpdateTimestampAndLogChange(tx, newVersionIDmssql, "system", OpTypeSystemEvent, strPtr(userName))
	})
	if err != nil {
		return nil, err
	}
	return &createdVersion, nil
}
func (c *Core) ListVersions() ([]Version, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	var versions []Version
	if err := DB.Order("created_at DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}
func (c *Core) RestoreAsNewCurrentVersion(versionIDToRestoreStr string, userNamePerformingRestore string) (*Version, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	if userNamePerformingRestore == "" {
		return nil, errors.New("userNamePerformingRestore is required")
	}
	versionIDToRestore, err := parseMSSQLUniqueIdentifierFromString(versionIDToRestoreStr)
	if err != nil {
		return nil, err
	}
	var sourceVersionToRestore Version
	if err := DB.First(&sourceVersionToRestore, "version_id = ?", versionIDToRestore).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("source version %s not found to restore from", versionIDToRestoreStr)
		}
		return nil, fmt.Errorf("error fetching source version %s: %w", versionIDToRestoreStr, err)
	}
	var finalNewCurrentVersion Version
	pkGeneratorFuncSQL := "NEWID()"
	err = DB.Transaction(func(tx *gorm.DB) error {
		autoSnapshotDescriptionText := fmt.Sprintf("Auto-Snapshot: Live state before restoring from Version ID %s", sourceVersionToRestore.VersionID.String()[:8])
		autoSnapshotVersionEntry := Version{CreatedBy: strPtr(userNamePerformingRestore), Description: &autoSnapshotDescriptionText}
		if err := tx.Create(&autoSnapshotVersionEntry).Error; err != nil {
			return fmt.Errorf("error creating auto-snapshot Version entry: %w", err)
		}
		autoSnapshotVID := autoSnapshotVersionEntry.VersionID
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO line_histories (history_pk, version_id, id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, created_at, updated_at, created_by, updated_by, name, description FROM lines`, pkGeneratorFuncSQL), autoSnapshotVID).Error; err != nil {
			return fmt.Errorf("error auto-snapshotting Lines: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO station_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM stations`, pkGeneratorFuncSQL), autoSnapshotVID).Error; err != nil {
			return fmt.Errorf("error auto-snapshotting Stations: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO tool_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM tools`, pkGeneratorFuncSQL), autoSnapshotVID).Error; err != nil {
			return fmt.Errorf("error auto-snapshotting Tools: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO operation_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM operations`, pkGeneratorFuncSQL), autoSnapshotVID).Error; err != nil {
			return fmt.Errorf("error auto-snapshotting Operations: %w", err)
		}
		if err := tx.Exec("DELETE FROM operations").Error; err != nil {
			return fmt.Errorf("error deleting live Operations: %w", err)
		}
		if err := tx.Exec("DELETE FROM tools").Error; err != nil {
			return fmt.Errorf("error deleting live Tools: %w", err)
		}
		if err := tx.Exec("DELETE FROM stations").Error; err != nil {
			return fmt.Errorf("error deleting live Stations: %w", err)
		}
		if err := tx.Exec("DELETE FROM lines").Error; err != nil {
			return fmt.Errorf("error deleting live Lines: %w", err)
		}
		if err := tx.Exec(`INSERT INTO lines (id, created_at, updated_at, created_by, updated_by, name, description) SELECT id, created_at, updated_at, created_by, updated_by, name, description FROM line_histories WHERE version_id = ?`, versionIDToRestore).Error; err != nil {
			return fmt.Errorf("error restoring Lines from history: %w", err)
		}
		if err := tx.Exec(`INSERT INTO stations (id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM station_histories WHERE version_id = ?`, versionIDToRestore).Error; err != nil {
			return fmt.Errorf("error restoring Stations from history: %w", err)
		}
		if err := tx.Exec(`INSERT INTO tools (id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM tool_histories WHERE version_id = ?`, versionIDToRestore).Error; err != nil {
			return fmt.Errorf("error restoring Tools from history: %w", err)
		}
		if err := tx.Exec(`INSERT INTO operations (id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM operation_histories WHERE version_id = ?`, versionIDToRestore).Error; err != nil {
			return fmt.Errorf("error restoring Operations from history: %w", err)
		}
		sourceDesc := "<no description>"
		if sourceVersionToRestore.Description != nil && *sourceVersionToRestore.Description != "" {
			sourceDesc = *sourceVersionToRestore.Description
		} else {
			sourceDesc = fmt.Sprintf("Version created at %s", sourceVersionToRestore.CreatedAt.Format(time.RFC822))
		}
		finalSnapshotDescriptionText := fmt.Sprintf("Restored to state of: '%s' (Source Version ID: %s)", sourceDesc, sourceVersionToRestore.VersionID.String()[:8])
		finalCurrentVersionEntry := Version{CreatedBy: strPtr(userNamePerformingRestore), Description: &finalSnapshotDescriptionText}
		if err := tx.Create(&finalCurrentVersionEntry).Error; err != nil {
			return fmt.Errorf("error creating new current Version entry after restore: %w", err)
		}
		finalCurrentSnapshotVID := finalCurrentVersionEntry.VersionID
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO line_histories (history_pk, version_id, id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, created_at, updated_at, created_by, updated_by, name, description FROM lines`, pkGeneratorFuncSQL), finalCurrentSnapshotVID).Error; err != nil {
			return fmt.Errorf("error snapshotting restored Lines: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO station_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM stations`, pkGeneratorFuncSQL), finalCurrentSnapshotVID).Error; err != nil {
			return fmt.Errorf("error snapshotting restored Stations: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO tool_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM tools`, pkGeneratorFuncSQL), finalCurrentSnapshotVID).Error; err != nil {
			return fmt.Errorf("error snapshotting restored Tools: %w", err)
		}
		if err := tx.Exec(fmt.Sprintf(`INSERT INTO operation_histories (history_pk, version_id, id, parent_id, created_at, updated_at, created_by, updated_by, name, description) SELECT %s, ?, id, parent_id, created_at, updated_at, created_by, updated_by, name, description FROM operations`, pkGeneratorFuncSQL), finalCurrentSnapshotVID).Error; err != nil {
			return fmt.Errorf("error snapshotting restored Operations: %w", err)
		}
		if err := tx.First(&finalNewCurrentVersion, "version_id = ?", finalCurrentSnapshotVID).Error; err != nil {
			return fmt.Errorf("error reloading new current Version entry: %w", err)
		}
		log.Printf("State from version %s restored as new current version %s by %s successfully.", versionIDToRestore.String(), finalCurrentSnapshotVID.String(), userNamePerformingRestore)
		return updateGlobalLastUpdateTimestampAndLogChange(tx, finalCurrentSnapshotVID, "system", OpTypeSystemEvent, strPtr(userNamePerformingRestore))
	})
	if err != nil {
		return nil, err
	}
	return &finalNewCurrentVersion, nil
}
func (c *Core) GetLinesForVersion(versionIDStr string) ([]Line, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	versionIDmssql, err := parseMSSQLUniqueIdentifierFromString(versionIDStr)
	if err != nil {
		return nil, err
	}
	var lineHistories []LineHistory
	if err := DB.Where("version_id = ?", versionIDmssql).Order("created_at asc").Find(&lineHistories).Error; err != nil {
		return nil, fmt.Errorf("error fetching line histories for version %s: %w", versionIDStr, err)
	}
	linesForVersion := make([]Line, len(lineHistories))
	for i, lh := range lineHistories {
		linesForVersion[i] = Line{BaseModel: BaseModel{ID: lh.ID, CreatedAt: lh.CreatedAt, UpdatedAt: lh.UpdatedAt, CreatedBy: lh.CreatedBy, UpdatedBy: lh.UpdatedBy}, Name: lh.Name, Description: lh.Description, Stations: nil}
	}
	return linesForVersion, nil
}
func (c *Core) GetChildEntitiesForVersion(versionIDStr string, parentEntityOriginalIDStr string, childEntityTypeStr string) ([]interface{}, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	versionIDmssql, err := parseMSSQLUniqueIdentifierFromString(versionIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid versionID: %w", err)
	}
	parentEntityOriginalIDmssql, err := parseMSSQLUniqueIdentifierFromString(parentEntityOriginalIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid parentEntityOriginalID: %w", err)
	}
	var results []interface{}
	switch strings.ToLower(childEntityTypeStr) {
	case "station":
		var items []StationHistory
		if err := DB.Where("version_id = ? AND parent_id = ?", versionIDmssql, parentEntityOriginalIDmssql).Order("created_at asc").Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			station := Station{BaseModel: BaseModel{ID: items[i].ID, CreatedAt: items[i].CreatedAt, UpdatedAt: items[i].UpdatedAt, CreatedBy: items[i].CreatedBy, UpdatedBy: items[i].UpdatedBy}, Name: items[i].Name, Description: items[i].Description, ParentID: items[i].ParentID}
			results = append(results, &station)
		}
	case "tool":
		var items []ToolHistory
		if err := DB.Where("version_id = ? AND parent_id = ?", versionIDmssql, parentEntityOriginalIDmssql).Order("created_at asc").Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			tool := Tool{BaseModel: BaseModel{ID: items[i].ID, CreatedAt: items[i].CreatedAt, UpdatedAt: items[i].UpdatedAt, CreatedBy: items[i].CreatedBy, UpdatedBy: items[i].UpdatedBy}, Name: items[i].Name, Description: items[i].Description, ParentID: items[i].ParentID}
			results = append(results, &tool)
		}
	case "operation":
		var items []OperationHistory
		if err := DB.Where("version_id = ? AND parent_id = ?", versionIDmssql, parentEntityOriginalIDmssql).Order("created_at asc").Find(&items).Error; err != nil {
			return nil, err
		}
		for i := range items {
			operation := Operation{BaseModel: BaseModel{ID: items[i].ID, CreatedAt: items[i].CreatedAt, UpdatedAt: items[i].UpdatedAt, CreatedBy: items[i].CreatedBy, UpdatedBy: items[i].UpdatedBy}, Name: items[i].Name, Description: items[i].Description, ParentID: items[i].ParentID}
			results = append(results, &operation)
		}
	default:
		return nil, fmt.Errorf("GetChildEntitiesForVersion not implemented for child type: %s", childEntityTypeStr)
	}
	return results, nil
}
func (c *Core) GetVersionedEntityHierarchy(versionIDStr string, rootEntityTypeStr string, rootEntityOriginalIDStr string) (interface{}, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	versionIDmssql, err := parseMSSQLUniqueIdentifierFromString(versionIDStr)
	if err != nil {
		return nil, err
	}
	rootEntityOriginalIDmssql, err := parseMSSQLUniqueIdentifierFromString(rootEntityOriginalIDStr)
	if err != nil {
		return nil, err
	}
	if strings.ToLower(rootEntityTypeStr) != "line" {
		return nil, errors.New("GetVersionedEntityHierarchy currently only implemented for root 'line'")
	}
	var lineHist LineHistory
	if err := DB.Where("version_id = ? AND id = ?", versionIDmssql, rootEntityOriginalIDmssql).First(&lineHist).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("line with original ID %s in version %s not found", rootEntityOriginalIDStr, versionIDStr)
		}
		return nil, err
	}
	reconstructedLine := Line{BaseModel: BaseModel{ID: lineHist.ID, CreatedAt: lineHist.CreatedAt, UpdatedAt: lineHist.UpdatedAt, CreatedBy: lineHist.CreatedBy, UpdatedBy: lineHist.UpdatedBy}, Name: lineHist.Name, Description: lineHist.Description, Stations: []Station{}}
	var stationHists []StationHistory
	DB.Where("version_id = ? AND parent_id = ?", versionIDmssql, lineHist.ID).Order("created_at asc").Find(&stationHists)
	for _, sh := range stationHists {
		station := Station{BaseModel: BaseModel{ID: sh.ID, CreatedAt: sh.CreatedAt, UpdatedAt: sh.UpdatedAt, CreatedBy: sh.CreatedBy, UpdatedBy: sh.UpdatedBy}, Name: sh.Name, Description: sh.Description, ParentID: sh.ParentID, Tools: []Tool{}}
		var toolHists []ToolHistory
		DB.Where("version_id = ? AND parent_id = ?", versionIDmssql, sh.ID).Order("created_at asc").Find(&toolHists)
		for _, th := range toolHists {
			tool := Tool{BaseModel: BaseModel{ID: th.ID, CreatedAt: th.CreatedAt, UpdatedAt: th.UpdatedAt, CreatedBy: th.CreatedBy, UpdatedBy: th.UpdatedBy}, Name: th.Name, Description: th.Description, ParentID: th.ParentID, Operations: []Operation{}}
			var opHists []OperationHistory
			DB.Where("version_id = ? AND parent_id = ?", versionIDmssql, th.ID).Order("created_at asc").Find(&opHists)
			for _, oh := range opHists {
				op := Operation{BaseModel: BaseModel{ID: oh.ID, CreatedAt: oh.CreatedAt, UpdatedAt: oh.UpdatedAt, CreatedBy: oh.CreatedBy, UpdatedBy: oh.UpdatedBy}, Name: oh.Name, Description: oh.Description, ParentID: oh.ParentID}
				tool.Operations = append(tool.Operations, op)
			}
			station.Tools = append(station.Tools, tool)
		}
		reconstructedLine.Stations = append(reconstructedLine.Stations, station)
	}
	return &reconstructedLine, nil
}
func (c *Core) ExportEntityHierarchyToJSON(entityTypeStr string, entityIDStr string, filePath string) error {
	if DB == nil {
		return errors.New("DB not initialized")
	}
	if filePath == "" {
		return errors.New("export filePath is empty")
	}
	hierarchyData, err := internalGetEntityHierarchy(entityTypeStr, entityIDStr)
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
func (c *Core) ImportEntityHierarchyFromJSON_UseOriginalData(importingUserName string, filePath string) (err error) {
	if DB == nil {
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
	tx := DB.Begin()
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
func (c *Core) ImportCopiedEntityHierarchyFromJSON(userName string, entityTypeStr string, parentIDStrIfApplicable string, jsonData string) (interface{}, error) {
	if DB == nil {
		return nil, errors.New("DB not initialized")
	}
	if userName == "" {
		return nil, errors.New("userName is required for importing copied entity")
	}
	var rootEntityData interface{}
	tempModelInstance, err := getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(jsonData), tempModelInstance); err != nil {
		return nil, fmt.Errorf("error unmarshalling copied JSON data: %w", err)
	}
	rootEntityData = tempModelInstance
	var parentIDmssql mssql.UniqueIdentifier
	if parentIDStrIfApplicable != "" {
		parentIDmssql, err = parseMSSQLUniqueIdentifierFromString(parentIDStrIfApplicable)
		if err != nil {
			return nil, fmt.Errorf("invalid ParentID for copied entity: %w", err)
		}
	}
	var newTopEntity interface{}
	idMap := make(map[mssql.UniqueIdentifier]mssql.UniqueIdentifier)
	err = DB.Transaction(func(tx *gorm.DB) error {
		newTopEntityMSSQLID, errTx := importCopiedEntityRecursive(tx, userName, rootEntityData, entityTypeStr, parentIDmssql, idMap)
		if errTx != nil {
			return errTx
		}
		reloadedTopEntity, _ := getModelInstance(entityTypeStr)
		if errLoad := tx.Preload(clause.Associations).First(reloadedTopEntity, "id = ?", newTopEntityMSSQLID).Error; errLoad != nil {
			return fmt.Errorf("error reloading newly created top entity: %w", errLoad)
		}
		newTopEntity = reloadedTopEntity
		return tx.Model(&AppMetadata{}).Where("config_key = ?", GlobalMetadataKey).Update("last_update", time.Now()).Error
	})
	if err != nil {
		return nil, err
	}
	return newTopEntity, nil
}
func importCopiedEntityRecursive(tx *gorm.DB, userName string, originalEntityData interface{}, entityTypeStr string, newParentActualDBID mssql.UniqueIdentifier, idMap map[mssql.UniqueIdentifier]mssql.UniqueIdentifier) (mssql.UniqueIdentifier, error) {
	var oldIDFromJSON mssql.UniqueIdentifier
	var newEntityToCreate interface{}
	var childrenToProcess []interface{}
	var childEntityTypeStr string
	createBase := func() BaseModel { return BaseModel{CreatedBy: strPtr(userName), UpdatedBy: strPtr(userName)} }
	var emptyMsSQLID mssql.UniqueIdentifier
	switch entity := originalEntityData.(type) {
	case *Line:
		oldIDFromJSON = entity.ID
		newLine := Line{BaseModel: createBase(), Name: entity.Name, Description: entity.Description}
		newEntityToCreate = &newLine
		childEntityTypeStr = "station"
		for i := range entity.Stations {
			childrenToProcess = append(childrenToProcess, &entity.Stations[i])
		}
	case *Station:
		oldIDFromJSON = entity.ID
		newStation := Station{BaseModel: createBase(), ParentID: newParentActualDBID, Name: entity.Name, Description: entity.Description}
		newEntityToCreate = &newStation
		childEntityTypeStr = "tool"
		for i := range entity.Tools {
			childrenToProcess = append(childrenToProcess, &entity.Tools[i])
		}
	case *Tool:
		oldIDFromJSON = entity.ID
		newTool := Tool{BaseModel: createBase(), ParentID: newParentActualDBID, Name: entity.Name, Description: entity.Description}
		newEntityToCreate = &newTool
		childEntityTypeStr = "operation"
		for i := range entity.Operations {
			childrenToProcess = append(childrenToProcess, &entity.Operations[i])
		}
	case *Operation:
		oldIDFromJSON = entity.ID
		newOperation := Operation{BaseModel: createBase(), ParentID: newParentActualDBID, Name: entity.Name, Description: entity.Description}
		newEntityToCreate = &newOperation
	default:
		return emptyMsSQLID, fmt.Errorf("unknown type in importCopiedEntityRecursive: %T", originalEntityData)
	}
	if err := tx.Omit(clause.Associations).Create(newEntityToCreate).Error; err != nil {
		return emptyMsSQLID, fmt.Errorf("error creating new copied entity %s: %w", entityTypeStr, err)
	}
	var newActualDBID mssql.UniqueIdentifier
	reflectVal := reflect.ValueOf(newEntityToCreate).Elem()
	newActualDBID = reflectVal.FieldByName("ID").Interface().(mssql.UniqueIdentifier)
	if oldIDFromJSON != emptyMsSQLID {
		idMap[oldIDFromJSON] = newActualDBID
	}
	for _, childData := range childrenToProcess {
		if _, err := importCopiedEntityRecursive(tx, userName, childData, childEntityTypeStr, newActualDBID, idMap); err != nil {
			return emptyMsSQLID, err
		}
	}
	return newActualDBID, nil
}
