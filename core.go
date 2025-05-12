package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/driver/sqlite"
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

func (c *Core) beforeClose(ctx context.Context) (prevent bool) {
	dialog, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
		Type:    runtime.QuestionDialog,
		Title:   "Quit?",
		Message: "Are you sure you want to quit?",
	})

	if err != nil {
		return false
	}
	return dialog != "Yes"
}

func (c *Core) SelectDir() (string, error) {
	return runtime.OpenDirectoryDialog(c.ctx, runtime.OpenDialogOptions{})
}

func (c *Core) HandleExport(entityType string, entityID string) error {
	file, _ := runtime.SaveFileDialog(c.ctx, runtime.SaveDialogOptions{
		DefaultFilename: fmt.Sprintf("%s_%s_export.json", entityType, entityID),
		Title:           "Export as JSON",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
			{DisplayName: "All Files", Pattern: "*.*"},
		},
	})
	return c.ExportEntityHierarchyToJSON(entityType, entityID, file)
}

func (c *Core) HandleImport(user string) error {
	file, _ := runtime.OpenFileDialog(c.ctx, runtime.OpenDialogOptions{
		Title: "Import as JSON",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
			{DisplayName: "All Files", Pattern: "*.*"},
		},
	})
	return c.ImportEntityHierarchyFromJSON(user, file)
}

var DB *gorm.DB

func (c *Core) InitDB() error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("error getting user config directory: %w", err)
	}
	appDataDir := filepath.Join(configDir, "ConfigExplorerPanelData")
	if err := os.MkdirAll(appDataDir, os.ModePerm); err != nil {
		return fmt.Errorf("error creating app data directory '%s': %w", appDataDir, err)
	}
	dbPath := filepath.Join(appDataDir, "config_explorer_wal.db?_journal_mode=WAL&_foreign_keys=1")
	log.Printf("Database path (WAL mode): %s\n", dbPath)
	database, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("error connecting to database: %w", err)
	}
	log.Println("Successfully connected to database (WAL mode).")
	if err := database.Exec("PRAGMA foreign_keys = ON;").Error; err != nil {
		log.Printf("Warning: Could not explicitly enable PRAGMA foreign_keys: %v\n", err)
	}
	err = database.AutoMigrate(&Line{}, &Station{}, &Tool{}, &Operation{})
	if err != nil {
		return fmt.Errorf("error during auto-migration of tables: %w", err)
	}
	log.Println("Database migration completed successfully.")
	DB = database
	return nil
}

func (c *Core) getModelInstance(entityTypeStr string) (interface{}, error) {
	switch strings.ToLower(entityTypeStr) {
	case "line":
		return &Line{}, nil
	case "station":
		return &Station{}, nil
	case "tool":
		return &Tool{}, nil
	case "operation":
		return &Operation{}, nil
	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityTypeStr)
	}
}

func (c *Core) parseUUIDFromString(idStr string) (uuid.UUID, error) {
	if idStr == "" {
		return uuid.Nil, errors.New("ID string must not be empty when a UUID is expected")
	}
	parsedID, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid UUID format for ID '%s': %w", idStr, err)
	}
	return parsedID, nil
}

func (c *Core) CreateEntity(userName string, entityTypeStr string, parentIDStr_optional string) (string, error) {
	if DB == nil {
		return "", errors.New("database not initialized")
	}
	if userName == "" {
		return "", errors.New("username must not be empty when creating")
	}
	model, err := c.getModelInstance(entityTypeStr)
	if err != nil {
		return "", err
	}
	var parentID uuid.UUID
	if parentIDStr_optional != "" {
		parentID, err = c.parseUUIDFromString(parentIDStr_optional)
		if err != nil {
			return "", fmt.Errorf("invalid parentID: %w", err)
		}
	}
	strPtr := func(s string) *string { return &s }
	needsParent := false
	switch m := model.(type) {
	case *Line:
		if parentID != uuid.Nil {
			return "", errors.New("lines cannot have a parentID")
		}
		m.CreatedBy = strPtr(userName)
		m.UpdatedBy = strPtr(userName)
	case *Station:
		needsParent = true
		if parentID != uuid.Nil {
			m.ParentID = parentID
		}
		m.CreatedBy = strPtr(userName)
		m.UpdatedBy = strPtr(userName)
	case *Tool:
		needsParent = true
		if parentID != uuid.Nil {
			m.ParentID = parentID
		}
		m.CreatedBy = strPtr(userName)
		m.UpdatedBy = strPtr(userName)
	case *Operation:
		needsParent = true
		if parentID != uuid.Nil {
			m.ParentID = parentID
		}
		m.CreatedBy = strPtr(userName)
		m.UpdatedBy = strPtr(userName)
	default:
		return "", fmt.Errorf("entity type %s not configured for creation", entityTypeStr)
	}
	if needsParent && parentID == uuid.Nil {
		return "", fmt.Errorf("parentID is required for entity type: %s", entityTypeStr)
	}
	if err := DB.Create(model).Error; err != nil {
		return "", fmt.Errorf("error creating entity of type %s: %w", entityTypeStr, err)
	}
	var newEntityID uuid.UUID
	switch m := model.(type) {
	case *Line:
		newEntityID = m.ID
	case *Station:
		newEntityID = m.ID
	case *Tool:
		newEntityID = m.ID
	case *Operation:
		newEntityID = m.ID
	}
	return newEntityID.String(), nil
}

func (c *Core) UpdateEntityFieldsString(userName string, entityTypeStr string, entityIDStr string, updatesMapStr map[string]string) error {
	if DB == nil {
		return errors.New("database not initialized")
	}
	if userName == "" {
		return errors.New("username must not be empty when updating")
	}
	entityID, err := c.parseUUIDFromString(entityIDStr)
	if err != nil {
		return err
	}
	modelInstance, err := c.getModelInstance(entityTypeStr)
	if err != nil {
		return err
	}
	if err := DB.First(modelInstance, "id = ?", entityID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("entity of type %s with ID %s not found for update", entityTypeStr, entityID)
		}
		return fmt.Errorf("error loading entity %s (%s) for update: %w", entityTypeStr, entityID, err)
	}
	updatesForGorm := make(map[string]interface{})
	userPtr := func(s string) *string { return &s }
	for key, value := range updatesMapStr {
		updatesForGorm[strings.ToLower(key)] = &value
	}
	updatesForGorm["updated_by"] = userPtr(userName)
	result := DB.Model(modelInstance).Where("id = ?", entityID).Updates(updatesForGorm)
	if result.Error != nil {
		return fmt.Errorf("error updating entity of type %s with ID %s: %w", entityTypeStr, entityID, result.Error)
	}
	if result.RowsAffected == 0 && len(updatesMapStr) > 0 {
		log.Printf("Update for entity %s (%s) did not change any rows (values may have already been equal).", entityTypeStr, entityID)
	}
	return nil
}

func (c *Core) GetEntityDetailsByIDString(entityTypeStr string, entityIDStr string) (interface{}, error) {
	if DB == nil {
		return nil, errors.New("database not initialized")
	}
	entityID, err := c.parseUUIDFromString(entityIDStr)
	if err != nil {
		return nil, err
	}
	modelInstance, err := c.getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	if err := DB.First(modelInstance, "id = ?", entityID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("entity of type %s with ID %s not found", entityTypeStr, entityIDStr)
		}
		return nil, fmt.Errorf("error loading entity of type %s with ID %s: %w", entityTypeStr, entityIDStr, err)
	}
	return modelInstance, nil
}

func (c *Core) GetAllEntitiesByTypeString(entityTypeStr string) ([]interface{}, error) {
	if DB == nil {
		return nil, errors.New("database not initialized")
	}
	modelInstance, err := c.getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	var results []interface{}
	switch strings.ToLower(entityTypeStr) {
	case "line":
		var items []Line
		if errDb := DB.Model(modelInstance).Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "station":
		var items []Station
		if errDb := DB.Model(modelInstance).Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "tool":
		var items []Tool
		if errDb := DB.Model(modelInstance).Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "operation":
		var items []Operation
		if errDb := DB.Model(modelInstance).Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	default:
		return nil, fmt.Errorf("GetAllEntitiesByTypeString not implemented for type: %s", entityTypeStr)
	}
	return results, nil
}

func (c *Core) GetChildEntitiesString(parentIDStr string, childEntityTypeStr string) ([]interface{}, error) {
	if DB == nil {
		return nil, errors.New("database not initialized")
	}
	parentID, err := c.parseUUIDFromString(parentIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid parentID: %w", err)
	}
	var results []interface{}
	modelInstance, err := c.getModelInstance(childEntityTypeStr)
	if err != nil {
		return nil, err
	}
	switch strings.ToLower(childEntityTypeStr) {
	case "station":
		var items []Station
		if errDb := DB.Model(modelInstance).Where("parent_id = ?", parentID).Order("created_at asc").Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "tool":
		var items []Tool
		if errDb := DB.Model(modelInstance).Where("parent_id = ?", parentID).Order("created_at asc").Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "operation":
		var items []Operation
		if errDb := DB.Model(modelInstance).Where("parent_id = ?", parentID).Order("created_at asc").Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	default:
		return nil, fmt.Errorf("GetChildEntitiesString not implemented for child type: %s", childEntityTypeStr)
	}
	return results, nil
}

func (c *Core) GetEntityHierarchyString(entityTypeStr string, entityIDStr string) (interface{}, error) {
	if DB == nil {
		return nil, errors.New("database not initialized")
	}
	entityID, err := c.parseUUIDFromString(entityIDStr)
	if err != nil {
		return nil, err
	}
	modelInstance, err := c.getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}
	tx := DB
	switch strings.ToLower(entityTypeStr) {
	case "line":
		tx = tx.Preload("Stations.Tools.Operations")
	case "station":
		tx = tx.Preload("Tools.Operations")
	case "tool":
		tx = tx.Preload("Operations")
	case "operation":
		break
	default:
		return nil, fmt.Errorf("hierarchical loading not fully defined for type: %s", entityTypeStr)
	}
	if err := tx.First(modelInstance, "id = ?", entityID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("entity of type %s with ID %s for hierarchy not found", entityTypeStr, entityIDStr)
		}
		return nil, fmt.Errorf("error loading hierarchy for type %s, ID %s: %w", entityTypeStr, entityIDStr, err)
	}
	return modelInstance, nil
}

func (c *Core) ExportEntityHierarchyToJSON(entityTypeStr string, entityIDStr string, filePath string) error {
	if DB == nil {
		return errors.New("database not initialized")
	}
	if filePath == "" {
		return errors.New("file path for export must not be empty")
	}
	hierarchyData, err := c.GetEntityHierarchyString(entityTypeStr, entityIDStr)
	if err != nil {
		return fmt.Errorf("error loading entity hierarchy for export: %w", err)
	}
	jsonData, err := json.MarshalIndent(hierarchyData, "", "  ")
	if err != nil {
		return fmt.Errorf("error converting data to JSON: %w", err)
	}
	err = os.WriteFile(filePath, jsonData, 0644)
	if err != nil {
		return fmt.Errorf("error writing JSON file to '%s': %w", filePath, err)
	}
	log.Printf("Entity hierarchy successfully exported to '%s'.", filePath)
	return nil
}

func (c *Core) ImportEntityHierarchyFromJSON(importingUserName string, filePath string) (err error) {
	if DB == nil {
		return errors.New("database not initialized")
	}
	if filePath == "" {
		return errors.New("file path for import must not be empty")
	}
	log.Printf("Starting import from '%s' by '%s' (using original data from JSON, models with *string).", filePath, importingUserName)
	jsonData, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("error reading JSON file '%s': %w", filePath, err)
	}
	var rootImportedLine Line
	if err = json.Unmarshal(jsonData, &rootImportedLine); err != nil {
		return fmt.Errorf("error unmarshalling JSON data into Line structure: %w", err)
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return fmt.Errorf("error starting database transaction: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			log.Printf("Import (original data) aborted due to panic: %v", r)
		} else if err != nil {
			tx.Rollback()
			log.Printf("Import (original data) failed, rollback performed: %v", err)
		} else {
			commitErr := tx.Commit().Error
			if commitErr != nil {
				log.Printf("Error committing transaction (original data): %v", commitErr)
				err = commitErr
			} else {
				log.Println("Import (original data) completed successfully and transaction committed.")
			}
		}
	}()
	err = c.importEntityRecursive(tx, &rootImportedLine, "line", uuid.Nil)
	return err
}

func (c *Core) importEntityRecursive(currentTx *gorm.DB, originalEntityData interface{}, entityTypeStr string, newParentActualID uuid.UUID) error {
	var currentEntityID uuid.UUID
	var currentEntityNamePtr *string
	var childrenToProcess []interface{}
	var childEntityTypeStr string
	switch entity := originalEntityData.(type) {
	case *Line:
		if entity.ID == uuid.Nil {
			return fmt.Errorf("line in import JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		childEntityTypeStr = "station"
		for i := range entity.Stations {
			childrenToProcess = append(childrenToProcess, &entity.Stations[i])
		}
	case *Station:
		if entity.ID == uuid.Nil {
			return fmt.Errorf("station in import JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		entity.ParentID = newParentActualID
		childEntityTypeStr = "tool"
		for i := range entity.Tools {
			childrenToProcess = append(childrenToProcess, &entity.Tools[i])
		}
	case *Tool:
		if entity.ID == uuid.Nil {
			return fmt.Errorf("tool in import JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		entity.ParentID = newParentActualID
		childEntityTypeStr = "operation"
		for i := range entity.Operations {
			childrenToProcess = append(childrenToProcess, &entity.Operations[i])
		}
	case *Operation:
		if entity.ID == uuid.Nil {
			return fmt.Errorf("operation in import JSON has no ID")
		}
		currentEntityID = entity.ID
		currentEntityNamePtr = entity.Name
		entity.ParentID = newParentActualID
	default:
		return fmt.Errorf("unknown entity type in recursive import: %T", originalEntityData)
	}
	var logName string
	if currentEntityNamePtr != nil {
		logName = *currentEntityNamePtr
	} else {
		logName = "<NULL>"
	}
	modelToCheck, _ := c.getModelInstance(entityTypeStr)
	if err := currentTx.First(modelToCheck, "id = ?", currentEntityID).Error; err == nil {
		return fmt.Errorf("%s ID %s already exists. Import aborted", entityTypeStr, currentEntityID)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("database error checking %s ID %s: %w", entityTypeStr, currentEntityID, err)
	}
	log.Printf("DEBUG: Creating %s (without associations): %+v", entityTypeStr, originalEntityData)
	if err := currentTx.Omit(clause.Associations).Create(originalEntityData).Error; err != nil {
		return fmt.Errorf("error creating imported entity %s '%s' (ID: %s): %w", entityTypeStr, logName, currentEntityID, err)
	}
	log.Printf("Imported (original data): %s '%s' (ID: %s)", entityTypeStr, logName, currentEntityID)
	for _, childData := range childrenToProcess {
		if err := c.importEntityRecursive(currentTx, childData, childEntityTypeStr, currentEntityID); err != nil {
			return err
		}
	}
	return nil
}

func (c *Core) DeleteEntityByIDString(entityTypeStr string, entityIDStr string) error {
	if DB == nil {
		return errors.New("database not initialized")
	}
	entityID, err := c.parseUUIDFromString(entityIDStr)
	if err != nil {
		return err
	}
	modelInstance, err := c.getModelInstance(entityTypeStr)
	if err != nil {
		return err
	}
	result := DB.Where("id = ?", entityID).Delete(modelInstance)
	if result.Error != nil {
		return fmt.Errorf("error deleting entity of type %s with ID %s: %w", entityTypeStr, entityIDStr, result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("no entity of type %s with ID %s found to delete", entityTypeStr, entityIDStr)
	}
	return nil
}
