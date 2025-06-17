package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/joho/godotenv"
	mssql "github.com/microsoft/go-mssqldb"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

func newTestGormDB(t *testing.T) (*gorm.DB, *sql.DB, sqlmock.Sqlmock) {
	sqlDB, mock, err := sqlmock.New()
	assert.NoError(t, err)
	db, err := gorm.Open(sqlserver.New(sqlserver.Config{
		Conn: sqlDB,
	}), &gorm.Config{})
	assert.NoError(t, err)
	return db, sqlDB, mock
}
func setup() {
	envContent := `DB_USER=Testuser
DB_PASSWORD=Sich3resPassw0rt!
DB_HOST=localhost
DB_PORT=1433
DB_NAME=testDB
DB_ENCRYPT=true
DB_TRUSTSERVERCERTIFICATE=true
`

	// Schreibe die .env-Datei ins aktuelle Verzeichnis
	if err := os.WriteFile("test.env", []byte(envContent), 0644); err != nil {
		panic(fmt.Sprintf("failed to write .env file: %v", err))
	}
	// Lade die .env-Datei
	_ = godotenv.Load(".env")

	// Baue den DSN-String und setze MSSQL_DSN
	user := os.Getenv("DB_USER")
	pass := os.Getenv("DB_PASSWORD")
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	encrypt := os.Getenv("DB_ENCRYPT")
	trust := os.Getenv("DB_TRUSTSERVERCERTIFICATE")
	dsn := fmt.Sprintf(
		"sqlserver://%s:%s@%s:%s?database=%s&encrypt=%s&trustservercertificate=%s",
		user, pass, host, port, dbName, encrypt, trust,
	)
	os.Setenv("MSSQL_DSN", dsn)
}

// Helper: returns a Core with in-memory SQLite DB for testing
var sharedTestCore *Core

func newTestCore(t *testing.T) *Core {
	if sharedTestCore == nil {
		setup()
		wd, _ := os.Getwd()
		envPath := filepath.Join(wd, "test.env")
		_, err := os.Stat(envPath)
		if os.IsNotExist(err) {
			t.Fatalf("Environment file not found: %s", envPath)
		}
		_ = godotenv.Load(envPath)
		user := os.Getenv("DB_USER")
		pass := os.Getenv("DB_PASSWORD")
		host := os.Getenv("DB_HOST")
		port := os.Getenv("DB_PORT")
		encrypt := os.Getenv("DB_ENCRYPT")
		trust := os.Getenv("DB_TRUSTSERVERCERTIFICATE")
		dbName := os.Getenv("DB_NAME")
		if encrypt == "" {
			encrypt = "true"
		}
		if trust == "" {
			trust = "true"
		}

		dsn := fmt.Sprintf(
			"sqlserver://%s:%s@%s:%s?database=%s&encrypt=%s&trustservercertificate=%s",
			user, pass, host, port, dbName, encrypt, trust,
		)
		os.Setenv("MSSQL_DSN", dsn)
		assert.NotEmpty(t, dsn)
		db, err := gorm.Open(sqlserver.Open(dsn), &gorm.Config{})
		assert.NoError(t, err)
		err = db.AutoMigrate(&Line{}, &Station{}, &Tool{}, &Operation{}, &Version{}, &LineHistory{}, &StationHistory{}, &ToolHistory{}, &OperationHistory{}, &AppMetadata{}, &EntityChangeLog{})
		assert.NoError(t, err)
		sharedTestCore = &Core{DB: db, ctx: context.Background()}
	}
	return sharedTestCore
}

func TestParseTimestmpFlexible(t *testing.T) {
	now := time.Now().UTC()
	formats := []string{
		now.Format(time.RFC3339Nano),
		now.Format(time.RFC3339),
		now.Format("2006-01-02 15:04:05.9999999"),
	}
	for _, f := range formats {
		parsed, err := parseTimestampFlexible(f)
		assert.NoError(t, err)
		assert.WithinDuration(t, now, parsed, time.Second)
	}
	_, err := parseTimestampFlexible("invalid")
	assert.Error(t, err)
}

func TestStrPtr(t *testing.T) {
	s := "hello"
	ptr := strPtr(s)
	assert.NotNil(t, ptr)
	assert.Equal(t, s, *ptr)

	empty := ""
	ptrEmpty := strPtr(empty)
	assert.Nil(t, ptrEmpty)
}

func TestCheckEnvInExeDir(t *testing.T) {
	core := &Core{}
	exePath, _ := os.Executable()
	envPath := filepath.Join(filepath.Dir(exePath), ".env")
	_ = os.WriteFile(envPath, []byte("TEST=1"), 0644)
	defer os.Remove(envPath)
	assert.True(t, core.CheckEnvInExeDir())
	_ = os.Remove(envPath)
	assert.False(t, core.CheckEnvInExeDir())
}

func TestParseDSNFromEnv(t *testing.T) {
	os.Setenv("MSSQL_DSN", "sqlserver://user:pass@localhost:1433?database=testDB&encrypt=true&trustservercertificate=true")
	defer os.Unsetenv("MSSQL_DSN")
	core := &Core{}
	dsn, err := core.ParseDSNFromEnv()
	assert.NoError(t, err)
	assert.Equal(t, "user", dsn.User)
	assert.Equal(t, "pass", dsn.Password)
	assert.Equal(t, "localhost", dsn.Host)
	assert.Equal(t, "1433", dsn.Port)
	assert.Equal(t, "testDB", dsn.Database)
	assert.Equal(t, "true", dsn.Encrypt)
	assert.Equal(t, "true", dsn.TrustServerCertificate)

	os.Setenv("MSSQL_DSN", "")
	_, err = core.ParseDSNFromEnv()
	assert.Error(t, err)
}

func TestGetPlatformSpecificUserName(t *testing.T) {
	core := &Core{}
	name := core.GetPlatformSpecificUserName()
	assert.NotNil(t, name)
}

func TestCreateBaseFromOriginal(t *testing.T) {
	orig := BaseModel{
		Name:        strPtr("n"),
		Comment:     strPtr("c"),
		StatusColor: strPtr("red"),
	}
	base := createBaseFromOriginal(orig, "user")
	assert.NotNil(t, base.Name)
	assert.Equal(t, "user", *base.CreatedBy)
	assert.Equal(t, "user", *base.UpdatedBy)
}

func TestParseMSSQLUniqueIdentifierFromString(t *testing.T) {
	id := "123E4567-E89B-12D3-A456-426614174000"
	uid, err := parseMSSQLUniqueIdentifierFromString(id)
	assert.NoError(t, err)
	assert.Equal(t, id, uid.String())

	_, err = parseMSSQLUniqueIdentifierFromString("")
	assert.Error(t, err)
	_, err = parseMSSQLUniqueIdentifierFromString("not-a-uuid")
	assert.Error(t, err)
}

func TestGetModelInstance(t *testing.T) {
	types := []string{"line", "station", "tool", "operation", "linehistory", "stationhistory", "toolhistory", "operationhistory", "appmetadata"}
	for _, typ := range types {
		inst, err := getModelInstance(typ)
		assert.NoError(t, err)
		assert.NotNil(t, inst)
	}
	_, err := getModelInstance("unknown")
	assert.Error(t, err)
}

func TestGtIDFromModel(t *testing.T) {
	id := mssql.UniqueIdentifier{}

	_ = id.Scan("123E4567-E89B-12D3-A456-426614174000")
	line := &Line{
		BaseModel: BaseModel{ID: id},
	}
	assert.Equal(t, id, getIDFromModel(line))
	station := &Station{
		BaseModel: BaseModel{ID: id},
	}
	assert.Equal(t, id, getIDFromModel(station))
	tool := &Tool{
		BaseModel: BaseModel{ID: id},
	}
	assert.Equal(t, id, getIDFromModel(tool))
	op := &Operation{
		BaseModel: BaseModel{ID: id},
	}
	assert.Equal(t, id, getIDFromModel(op))
	var empty mssql.UniqueIdentifier
	assert.Equal(t, empty, getIDFromModel("not a model"))
}

func TestConfigureAndSaveDSN(t *testing.T) {
	core := &Core{}
	err := core.ConfigureAndSaveDSN("localhost", "1433", "testdb", "user", "pw", "true", "true")
	assert.NoError(t, err)
	// Check file exists
	exePath, _ := os.Executable()
	envPath := filepath.Join(filepath.Dir(exePath), ".env")
	_, statErr := os.Stat(envPath)
	assert.NoError(t, statErr)
	_ = os.Remove(envPath)
}

func TestGetGlobalLastUpdateTimestamp(t *testing.T) {
	core := newTestCore(t)
	ts, err := core.GetGlobalLastUpdateTimestamp()
	assert.NoError(t, err)
	_, err = time.Parse(time.RFC3339Nano, ts)
	assert.NoError(t, err)
}

func TestGetChangesSince(t *testing.T) {
	core := newTestCore(t)
	ts, _ := core.GetGlobalLastUpdateTimestamp()
	resp, err := core.GetChangesSince(ts)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
}

func TestCreateEntityAndDeleteEntityByIDString(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	// Create Line
	line, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	// Delete Line
	err = core.DeleteEntityByIDString(user, "line", lineID)
	assert.NoError(t, err)
}

func TestUpdateEntityFieldsString(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	line, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	ts, _ := core.GetGlobalLastUpdateTimestamp()
	updates := map[string]string{"Name": "newName"}
	_, err = core.UpdateEntityFieldsString(user, "line", lineID, ts, updates)
	assert.NoError(t, err)
}

func TestGetEntityDetails(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	line, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	entity, err := core.GetEntityDetails("line", lineID)
	assert.NoError(t, err)
	assert.NotNil(t, entity)
}

func TestGetAllEntities(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	_, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	entities, err := core.GetAllEntities("line", "")
	assert.NoError(t, err)
	assert.NotEmpty(t, entities)
}

func TestGetEntityHierarchyString(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	line, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	resp, err := core.GetEntityHierarchyString("line", lineID)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
}
func TestDeleteEntityByIDString(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	line, err := core.CreateEntity(user, "line", "")
	lineID := getIDFromModel(line).String()
	assert.NoError(t, err)
	core.DeleteEntityByIDString(user, "line", lineID)
	assert.NoError(t, err)
	// Check if the entity is deleted
	_, err = core.GetEntityDetails("line", lineID)
	assert.Error(t, err, "Expected error when fetching deleted entity")
	// Check if the entity is not in the list of all entities
	entities, err := core.GetAllEntities("line", "")
	assert.NoError(t, err)
	for _, entity := range entities {
		assert.NotEqual(t, lineID, getIDFromModel(entity).String(), "Deleted entity should not be in the list")
	}
}
func TestExportAndImportEntityHierarchyJSON(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	line, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	tmpFile := filepath.Join(os.TempDir(), "test_export.json")
	defer os.Remove(tmpFile)
	err = core.ExportEntityHierarchyToJSON("line", lineID, tmpFile)
	assert.NoError(t, err)
	err = core.ImportEntityHierarchyFromJSON_UseOriginalData(user, tmpFile)
	assert.Error(t, err)
	line2, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	lineID2 := getIDFromModel(line2).String()
	tmpFile2 := filepath.Join(os.TempDir(), "test_import.json")
	defer os.Remove(tmpFile2)
	err = core.ExportEntityHierarchyToJSON("line", lineID2, tmpFile2)
	core.DeleteEntityByIDString(user, "line", lineID2)
	assert.NoError(t, err)
}
func TestSetupBroker_Success(t *testing.T) {
	// This test assumes a running SQL Server instance and correct DB credentials in env.
	core := newTestCore(t)
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		t.Skip("DB_NAME not set in environment, skipping integration test")
	}
	queue, service, err := setupBroker(core.DB, dbName)
	assert.NoError(t, err)
	assert.NotEmpty(t, queue)
	assert.NotEmpty(t, service)
}

func TestCore_InitDB_Success(t *testing.T) {
	core := newTestCore(t)
	// Set a logger level
	os.Setenv("GORM_LOGGER_LEVEL", "silent")
	defer os.Unsetenv("GORM_LOGGER_LEVEL")

	core.ctx = context.Background()

	result := core.InitDB()
	assert.NotEmpty(t, result)

	// Check if the environment variables are set correctly
	assert.Equal(t, "InitSuccess", result)
	// Check if the DB connection is established
	db, err := core.DB.DB()
	assert.NoError(t, err)
	assert.NotNil(t, db)
}

func TestCore_InitDB_MissingDSN(t *testing.T) {
	core := &Core{}
	os.Unsetenv("MSSQL_DSN")
	result := core.InitDB()
	assert.Equal(t, "InitError", result)
}

func TestCore_InitDB_InvalidDSN(t *testing.T) {
	core := &Core{}
	os.Setenv("MSSQL_DSN", "invalid_dsn")
	defer os.Unsetenv("MSSQL_DSN")
	result := core.InitDB()
	assert.Equal(t, "InitError", result)
}
func TestCore_InitDB_DBError(t *testing.T) {
	core := &Core{}
	// Set a bad DSN to simulate a DB connection error
	os.Setenv("MSSQL_DSN", "sqlserver://baduser:badpass@localhost:1433?database=doesnotexist")
	defer os.Unsetenv("MSSQL_DSN")
	result := core.InitDB()
	assert.Equal(t, "InitError", result)
}
func TestGetChangesSince_DBNotInitialized(t *testing.T) {
	core := &Core{}
	_, err := core.GetChangesSince(time.Now().Format(time.RFC3339Nano))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "DB not initialized")
}

func TestGetChangesSince_InvalidTimestampFormat(t *testing.T) {
	core := newTestCore(t)
	_, err := core.GetChangesSince("not-a-timestamp")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid clientLastKnownTimestampStr format")
}

func TestGetChangesSince_NoChanges(t *testing.T) {
	core := newTestCore(t)
	ts, err := core.GetGlobalLastUpdateTimestamp()
	assert.NoError(t, err)
	resp, err := core.GetChangesSince(ts)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, ts, resp.NewGlobalLastUpdatedAt)
	assert.Empty(t, resp.UpdatedEntities)
	assert.Empty(t, resp.DeletedEntities)
}

func TestGetChangesSince_WithUpdateAndDelete(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	// Create entity
	line, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	// Get timestamp before update
	tsBefore, err := core.GetGlobalLastUpdateTimestamp()
	assert.NoError(t, err)
	// Update entity
	updates := map[string]string{"Name": "changed"}
	_, err = core.UpdateEntityFieldsString(user, "line", lineID, tsBefore, updates)
	assert.NoError(t, err)
	// Delete entity
	err = core.DeleteEntityByIDString(user, "line", lineID)
	assert.NoError(t, err)
	// Get changes since tsBefore
	resp, err := core.GetChangesSince(tsBefore)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	// Should contain update and delete for "line"
	foundUpdate := false
	foundDelete := false
	for _, ids := range resp.UpdatedEntities {
		for _, id := range ids {
			if id == lineID {
				foundUpdate = true
			}
		}
	}
	for _, ids := range resp.DeletedEntities {
		for _, id := range ids {
			if id == lineID {
				foundDelete = true
			}
		}
	}
	assert.True(t, foundUpdate || foundDelete)
}

func TestGetChangesSince_SystemEvent(t *testing.T) {
	core := newTestCore(t)
	// Insert a system event log manually
	now := time.Now()
	log := EntityChangeLog{
		EntityID:      mssql.UniqueIdentifier{},
		EntityType:    "system",
		OperationType: OpTypeSystemEvent,
		ChangeTime:    now,
	}
	err := core.DB.Create(&log).Error
	assert.NoError(t, err)
	ts := now.Add(-time.Second).Format(time.RFC3339Nano)
	resp, err := core.GetChangesSince(ts)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	// Should contain system_event in UpdatedEntities
	_, ok := resp.UpdatedEntities["system_event"]
	assert.True(t, ok)
}
func TestUpdateEntityFieldsString_Success(t *testing.T) {
	core := newTestCore(t)
	user := "testuser"
	// Create a line entity
	line, err := core.CreateEntity(user, "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	// Get current global last update timestamp
	ts, err := core.GetGlobalLastUpdateTimestamp()
	assert.NoError(t, err)
	// Prepare updates
	updates := map[string]string{
		"Name": "UpdatedLineName",
	}
	// Update entity
	updated, err := core.UpdateEntityFieldsString(user, "line", lineID, ts, updates)
	assert.NoError(t, err)
	assert.NotNil(t, updated)
	// Check if the update was applied
	updatedLine, ok := updated.(*Line)
	assert.True(t, ok)
	assert.NotNil(t, updatedLine.Name)
	assert.Equal(t, "UpdatedLineName", *updatedLine.Name)
}

func TestUpdateEntityFieldsString_DBNotInitialized(t *testing.T) {
	core := &Core{}
	_, err := core.UpdateEntityFieldsString("user", "line", "some-id", time.Now().Format(time.RFC3339Nano), map[string]string{"Name": "x"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "DB not initialized")
}

func TestUpdateEntityFieldsString_UserNameRequired(t *testing.T) {
	core := newTestCore(t)
	// Create entity
	line, err := core.CreateEntity("testuser", "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	ts, _ := core.GetGlobalLastUpdateTimestamp()
	_, err = core.UpdateEntityFieldsString("", "line", lineID, ts, map[string]string{"Name": "x"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "userName is required for update")
}

func TestUpdateEntityFieldsString_InvalidEntityID(t *testing.T) {
	core := newTestCore(t)
	ts, _ := core.GetGlobalLastUpdateTimestamp()
	_, err := core.UpdateEntityFieldsString("user", "line", "not-a-uuid", ts, map[string]string{"Name": "x"})
	assert.Error(t, err)
}

func TestUpdateEntityFieldsString_InvalidTimestamp(t *testing.T) {
	core := newTestCore(t)
	line, err := core.CreateEntity("testuser", "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	_, err = core.UpdateEntityFieldsString("testuser", "line", lineID, "not-a-timestamp", map[string]string{"Name": "x"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid updated_at format")
}

func TestUpdateEntityFieldsString_UnknownEntityType(t *testing.T) {
	core := newTestCore(t)
	line, err := core.CreateEntity("testuser", "line", "")
	assert.NoError(t, err)
	lineID := getIDFromModel(line).String()
	ts, _ := core.GetGlobalLastUpdateTimestamp()
	_, err = core.UpdateEntityFieldsString("testuser", "unknown", lineID, ts, map[string]string{"Name": "x"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown entity type")
}

func TestUpdateEntityFieldsString_RecordNotFound(t *testing.T) {
	core := newTestCore(t)
	// Use a random UUID that does not exist
	id := "123e4567-e89b-12d3-a456-426614174999"
	ts, _ := core.GetGlobalLastUpdateTimestamp()
	_, err := core.UpdateEntityFieldsString("testuser", "line", id, ts, map[string]string{"Name": "x"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "record not found or already deleted")
}
func TestDetectEntityTypeFromClipboard(t *testing.T) {
	// Helper UUID
	uuidStr := "123e4567-e89b-12d3-a456-426614174000"

	// Line JSON (has AssemblyArea and Stations)
	lineJSON := fmt.Sprintf(`{
		"ID": "%s",
		"AssemblyArea": "A1",
		"Stations": [],
		"Name": "Line1"
	}`, uuidStr)
	typ, err := detectEntityTypeFromClipboard(lineJSON)
	assert.NoError(t, err)
	assert.Equal(t, "line", typ)

	// Station JSON (has StationType and Tools)
	stationJSON := fmt.Sprintf(`{
		"ID": "%s",
		"StationType": "S1",
		"Tools": [],
		"Name": "Station1"
	}`, uuidStr)
	typ, err = detectEntityTypeFromClipboard(stationJSON)
	assert.NoError(t, err)
	assert.Equal(t, "station", typ)

	// Tool JSON (has ToolClass and Operations)
	toolJSON := fmt.Sprintf(`{
		"ID": "%s",
		"ToolClass": "T1",
		"Operations": [],
		"Name": "Tool1"
	}`, uuidStr)
	typ, err = detectEntityTypeFromClipboard(toolJSON)
	assert.NoError(t, err)
	assert.Equal(t, "tool", typ)

	// Operation JSON (has DecisionCriteria and SequenceGroup)
	operationJSON := fmt.Sprintf(`{
		"ID": "%s",
		"DecisionCriteria": "D1",
		"SequenceGroup": "SG1",
		"Name": "Op1"
	}`, uuidStr)
	typ, err = detectEntityTypeFromClipboard(operationJSON)
	assert.NoError(t, err)
	assert.Equal(t, "operation", typ)

	// Fallback: valid Line struct, but no AssemblyArea/Stations keys
	lineStructJSON := fmt.Sprintf(`{
		"ID": "%s",
		"Name": "line"
	}`, uuidStr)
	typ, err = detectEntityTypeFromClipboard(lineStructJSON)
	assert.NoError(t, err)
	assert.Equal(t, "line", typ)

	// Invalid JSON
	invalidJSON := `{invalid`
	typ, err = detectEntityTypeFromClipboard(invalidJSON)
	assert.Error(t, err)
	assert.Empty(t, typ)

	// Unknown type (valid JSON, but not matching any entity)
	unknownJSON := `{"foo": "bar"}`
	typ, err = detectEntityTypeFromClipboard(unknownJSON)
	assert.Error(t, err)
	assert.Empty(t, typ)
}
func TestCreateBaseFromOriginal_GeneratesNewIDAndTimestamps(t *testing.T) {
	orig := BaseModel{
		Name:        strPtr("OriginalName"),
		Comment:     strPtr("OriginalComment"),
		StatusColor: strPtr("blue"),
	}
	user := "testuser"
	base := createBaseFromOriginal(orig, user)

	assert.NotNil(t, base.Name)
	assert.Equal(t, *orig.Name, *base.Name)
	assert.NotNil(t, base.Comment)
	assert.Equal(t, *orig.Comment, *base.Comment)
	assert.NotNil(t, base.StatusColor)
	assert.Equal(t, *orig.StatusColor, *base.StatusColor)

	// ID should be a valid UUID and not zero
	var zeroID mssql.UniqueIdentifier
	assert.NotEqual(t, zeroID, base.ID)
	assert.NotEmpty(t, base.ID.String())

	// CreatedAt and UpdatedAt should be close to now
	now := time.Now()
	assert.WithinDuration(t, now, base.CreatedAt, time.Second)
	assert.WithinDuration(t, now, base.UpdatedAt, time.Second)

	// CreatedBy and UpdatedBy should be set to user
	assert.NotNil(t, base.CreatedBy)
	assert.NotNil(t, base.UpdatedBy)
	assert.Equal(t, user, *base.CreatedBy)
	assert.Equal(t, user, *base.UpdatedBy)
}

func TestCreateBaseFromOriginal_NilFields(t *testing.T) {
	orig := BaseModel{}
	user := "anotheruser"
	base := createBaseFromOriginal(orig, user)

	assert.Nil(t, base.Name)
	assert.Nil(t, base.Comment)
	assert.Nil(t, base.StatusColor)
	assert.NotEqual(t, mssql.UniqueIdentifier{}, base.ID)
	assert.NotNil(t, base.CreatedBy)
	assert.NotNil(t, base.UpdatedBy)
	assert.Equal(t, user, *base.CreatedBy)
	assert.Equal(t, user, *base.UpdatedBy)
}
func TestCore_cleanupBroker_Success(t *testing.T) {
	// Use a real DB if available, otherwise use a sqlmock
	db, sqlDB, mock := newTestGormDB(t)
	defer sqlDB.Close()
	core := &Core{
		DB:          db,
		queueName:   "TestQueue",
		serviceName: "TestService",
	}
	// Expect two Execs (service, queue)
	mock.ExpectExec("DROP SERVICE").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DROP QUEUE").WillReturnResult(sqlmock.NewResult(0, 1))
	core.cleanupBroker()
	// Ensure all expectations were met
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCore_cleanupBroker_ExecStatements(t *testing.T) {
	// Use a real DB if available, otherwise use a sqlmock
	db, sqlDB, mock := newTestGormDB(t)
	defer sqlDB.Close()
	core := &Core{
		DB:          db,
		queueName:   "TestQueue",
		serviceName: "TestService",
	}

	// Expect two Execs (service, queue)
	mock.ExpectExec("DROP SERVICE").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DROP QUEUE").WillReturnResult(sqlmock.NewResult(0, 1))

	core.cleanupBroker()

	// Ensure all expectations were met
	assert.NoError(t, mock.ExpectationsWereMet())
}
