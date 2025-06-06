package main

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestHandleImport(t *testing.T) {

}

func TestStrPtr(t *testing.T) {
	// Test with a valid string
	str := "test"
	ptr := strPtr(str)
	if ptr == nil || *ptr != str {
		t.Fatalf("Expected pointer to point to '%s', got: %v", str, ptr)
	}

	// Test with an empty string
	emptyStr := ""
	emptyPtr := strPtr(emptyStr)
	if emptyPtr == nil || *emptyPtr != emptyStr {
		t.Fatalf("Expected pointer to point to an empty string, got: %v", emptyPtr)
	}

}

func TestCheckEnvInExeDir(t *testing.T) {
	// Create a temporary directory
	var core = &Core{}
	tempDir, err := os.MkdirTemp("", "test-env")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	core.ConfigureAndSaveDSN("MSSQL_DSN", "test_user", "test_password", "localhost", "1433", "test_db", "true")
	// Create a .env file in the temporary directory
	envFilePath := filepath.Join(tempDir, ".env")
	fmt.Printf("Creating .env file at: %s\n", envFilePath) // Uncomment for debug output
	exePath, exeErr := os.Executable()
	if exeErr != nil {
		t.Fatalf("Failed to get executable path: %v", exeErr)
	}
	fmt.Printf("%v\n", exePath)
	err = os.WriteFile(envFilePath, []byte("TEST_VAR=test_value"), 0644)
	if err != nil {
		t.Fatalf("Failed to write .env file: %v", err)
	}

	// Change the current working directory to the temporary directory
	err = os.Chdir(tempDir)
	if err != nil {
		t.Fatalf("Failed to change directory: %v", err)
	}

	// Call the function to check for .env file

	found := core.CheckEnvInExeDir()
	if !found {
		t.Fatal("Expected .env file to be found, but it was not.")
	}
	defer os.RemoveAll(tempDir)
}
func (d *DSNParams) String() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", d.User, d.Password, d.Host, d.Port, d.Database)
}
func TestParseDSNFromEnv(t *testing.T) {

	// Set an environment variable for testing
	os.Setenv("MSSQL_DSN", "user:password@tcp(localhost:3306)/dbname")
	// Call the function to parse DSN from environment variable
	core := &Core{}
	dsn, err := core.ParseDSNFromEnv()
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if dsn.String() != "user:password@tcp(localhost:3306)/dbname" {
		t.Fatalf("Expected DSN to be 'user:password@tcp(localhost:3306)/dbname', got: %s", dsn)
	}

	// Test with a non-existent environment variable
	_, err = core.ParseDSNFromEnv()
	if err == nil {
		t.Fatal("Expected an error when parsing non-existent DSN, but got none.")
	}
	defer os.Unsetenv("MSSQL_DSN")
	// Test with an empty environment variable
	os.Setenv("MSSQL_DSN", "")
	_, err = core.ParseDSNFromEnv()
	if err == nil {
		t.Fatal("Expected an error when parsing empty DSN, but got none.")
	}
	// Test with a malformed DSN
	os.Setenv("MSSQL_DSN", "not_a_dsn")
	_, err = core.ParseDSNFromEnv()
	if err == nil {
		t.Fatal("Expected an error when parsing malformed DSN, but got none.")
	}
	defer os.Unsetenv("MSSQL_DSN")

	// Test with a valid DSN that includes a port
	os.Setenv("MSSQL_DSN", "user:password@tcp(localhost:3306)/dbname?charset=utf8")
	dsn, err = core.ParseDSNFromEnv()

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if dsn.TrustServerCertificate != "user:password@tcp(localhost:3306)/dbname?charset=utf8" {
		t.Fatalf("Expected DSN to be 'user:password@tcp(localhost:3306)/dbname?charset=utf8', got: %s", dsn)
	}
	defer os.Unsetenv("VALID_DSN")

	// Test with a DSN that includes multiple parameters
	os.Setenv("MSSQL_DSN", "user:password@tcp(localhost:3306)/dbname?charset=utf8&parseTime=True&loc=Local")
	dsn, err = core.ParseDSNFromEnv()
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if dsn.String() != "user:password@tcp(localhost:3306)/dbname?charset=utf8&parseTime=True&loc=Local" {
		t.Fatalf("Expected DSN to be 'user:password@tcp(localhost:3306)/dbname', got: %s", dsn)
	}

	defer os.Unsetenv("MALFORMED_DSN")

}

func TestParseMSSQLUniqueIdentifierFromString(t *testing.T) {
	// Test with a valid unique identifier
	validID := "123E4567-E89B-12D3-A456-426614174000"
	parsedID, err := parseMSSQLUniqueIdentifierFromString(validID)
	if err != nil {
		t.Fatalf("Expected no error for valid ID, got: %v", err)
	}
	if parsedID.String() != validID {
		t.Fatalf("Expected parsed ID to be '%s', got: %s", validID, parsedID.String())
	}

	// Test with an invalid unique identifier
	invalidID := "not-a-valid-uuid"
	_, err = parseMSSQLUniqueIdentifierFromString(invalidID)
	if err == nil {
		t.Fatal("Expected an error for invalid ID, but got none.")
	}
}
