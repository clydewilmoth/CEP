package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Core struct {
	ctx context.Context
}

func NewCore() *Core {
	return &Core{}
}

func (c *Core) startup(ctx context.Context) {
	// Perform your setup here
	c.ctx = ctx
}

// domReady is called after front-end resources have been loaded
func (c Core) domReady(ctx context.Context) {
	// Add your action here
}

// beforeClose is called when the application is about to quit,
// either by clicking the window close button or calling runtime.Quit.
// Returning true will cause the application to continue, false will continue shutdown as normal.
func (c *Core) beforeClose(ctx context.Context) (prevent bool) {
	return false
}

// shutdown is called at application termination
func (c *Core) shutdown(ctx context.Context) {
	// Perform your teardown here
}

var DB *gorm.DB

func (c *Core) InitDB() error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("fehler beim Ermitteln des User-Konfigurationsverzeichnisses: %w", err)
	}
	appDataDir := filepath.Join(configDir, "ConfigExplorerPanelData")
	if err := os.MkdirAll(appDataDir, os.ModePerm); err != nil {
		return fmt.Errorf("fehler beim Erstellen des Anwendungsdatenverzeichnisses '%s': %w", appDataDir, err)
	}

	dbPath := filepath.Join(appDataDir, "config_explorer_wal.db?_journal_mode=WAL")
	log.Printf("Datenbankpfad (WAL-Modus): %s\n", dbPath)

	database, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("fehler beim Verbinden mit der Datenbank: %w", err)
	}

	log.Println("Erfolgreich mit der Datenbank verbunden (WAL-Modus).")

	err = database.AutoMigrate(&Line{}, &Station{}, &Tool{}, &Operation{})
	if err != nil {
		return fmt.Errorf("fehler bei der Auto-Migration der Tabellen: %w", err)
	}
	log.Println("Datenbank-Migration erfolgreich abgeschlossen.")

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
		return nil, fmt.Errorf("unbekannter Entitätstyp: %s", entityTypeStr)
	}
}

func (c *Core) parseUUIDFromString(idStr string) (uuid.UUID, error) {
	if idStr == "" {
		return uuid.Nil, errors.New("ID-String darf nicht leer sein, wenn eine UUID erwartet wird")
	}
	parsedID, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil, fmt.Errorf("ungültiges UUID-Format für ID '%s': %w", idStr, err)
	}
	return parsedID, nil
}

func (c *Core) CreateEntity(entityTypeStr string, parentIDStr_optional ...string) (string, error) {
	if DB == nil {
		return "", errors.New("datenbank nicht initialisiert")
	}
	model, err := c.getModelInstance(entityTypeStr)
	if err != nil {
		return "", err
	}

	var parentID uuid.UUID
	if len(parentIDStr_optional) > 0 && parentIDStr_optional[0] != "" {
		parentID, err = c.parseUUIDFromString(parentIDStr_optional[0])
		if err != nil {
			return "", fmt.Errorf("ungültige ParentID: %w", err)
		}
	}

	needsParent := false
	switch m := model.(type) {
	case *Station:
		needsParent = true
		if parentID != uuid.Nil {
			m.ParentID = parentID
		}
	case *Tool:
		needsParent = true
		if parentID != uuid.Nil {
			m.ParentID = parentID
		}
	case *Operation:
		needsParent = true
		if parentID != uuid.Nil {
			m.ParentID = parentID
		}
	case *Line:
		if parentID != uuid.Nil {
			return "", errors.New("linien können keine ParentID haben")
		}
	default:
		return "", fmt.Errorf("parentID-Handling nicht implementiert für Typ: %s", entityTypeStr)
	}

	if needsParent && parentID == uuid.Nil {
		return "", fmt.Errorf("parentID ist erforderlich für Entitätstyp: %s", entityTypeStr)
	}

	if err := DB.Create(model).Error; err != nil {
		return "", fmt.Errorf("fehler beim Erstellen der Entität vom Typ %s: %w", entityTypeStr, err)
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

func (c *Core) GetEntityDetailsByIDString(entityTypeStr string, entityIDStr string) (interface{}, error) {
	if DB == nil {
		return nil, errors.New("datenbank nicht initialisiert")
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
			return nil, fmt.Errorf("entität vom Typ %s mit ID %s nicht gefunden", entityTypeStr, entityIDStr)
		}
		return nil, fmt.Errorf("fehler beim Laden der Entität vom Typ %s mit ID %s: %w", entityTypeStr, entityIDStr, err)
	}
	return modelInstance, nil
}

func (c *Core) GetAllEntitiesByTypeString(entityTypeStr string) ([]interface{}, error) {
	if DB == nil {
		return nil, errors.New("datenbank nicht initialisiert")
	}
	modelInstance, err := c.getModelInstance(entityTypeStr)
	if err != nil {
		return nil, err
	}

	var results []interface{}
	switch strings.ToLower(entityTypeStr) { // Sicherstellen, dass der Vergleich case-insensitiv ist
	case "line":
		var items []Line
		if errDb := DB.Model(modelInstance).Order("created_at asc").Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "station":
		var items []Station
		if errDb := DB.Model(modelInstance).Order("created_at asc").Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "tool":
		var items []Tool
		if errDb := DB.Model(modelInstance).Order("created_at asc").Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	case "operation":
		var items []Operation
		if errDb := DB.Model(modelInstance).Order("created_at asc").Find(&items).Error; errDb != nil {
			return nil, errDb
		}
		for i := range items {
			results = append(results, &items[i])
		}
	default:
		return nil, fmt.Errorf("GetAllEntitiesByTypeString nicht implementiert für Typ: %s", entityTypeStr)
	}
	return results, nil
}
