package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/joho/godotenv"
	mssql "github.com/microsoft/go-mssqldb"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

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
	if err := os.WriteFile(".env", []byte(envContent), 0644); err != nil {
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
func newTestCore(t *testing.T) *Core {
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

	// ... wie gehabt ...
	dsn := fmt.Sprintf(
		"sqlserver://%s:%s@%s:%s?database=%s&encrypt=%s&trustservercertificate=%s",
		user, pass, host, port, dbName, encrypt, trust,
	)
	os.Setenv("MSSQL_DSN", dsn) // falls im Code benötigt
	assert.NotEmpty(t, dsn)
	db, err := gorm.Open(sqlserver.Open(dsn), &gorm.Config{})
	assert.NoError(t, err)
	err = db.AutoMigrate(&Line{}, &Station{}, &Tool{}, &Operation{}, &Version{}, &LineHistory{}, &StationHistory{}, &ToolHistory{}, &OperationHistory{}, &AppMetadata{}, &EntityChangeLog{})
	assert.NoError(t, err)
	return &Core{DB: db, ctx: context.Background()}
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
