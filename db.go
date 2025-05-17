package main

import (
	"log"
	"time"

	"github.com/google/uuid"
	mssql "github.com/microsoft/go-mssqldb"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key"`
	CreatedAt time.Time              `gorm:"type:datetime2"`
	UpdatedAt time.Time              `gorm:"type:datetime2"`
	CreatedBy *string                `gorm:"size:255;default:null"`
	UpdatedBy *string                `gorm:"size:255;default:null"`
}

func (base *BaseModel) BeforeCreate(tx *gorm.DB) (err error) {
	var emptyID mssql.UniqueIdentifier
	if base.ID == emptyID {
		googleUUID := uuid.New()
		var newMsID mssql.UniqueIdentifier
		errScan := newMsID.Scan(googleUUID.String())
		if errScan != nil {
			log.Printf("Error converting google/uuid to mssql.UniqueIdentifier in BeforeCreate: %v", errScan)
			return errScan
		}
		base.ID = newMsID
	}
	return
}

type Line struct {
	BaseModel
	Name        *string   `gorm:"size:255;default:null"`
	Description *string   `gorm:"default:null"`
	Stations    []Station `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Station struct {
	BaseModel
	Name        *string                `gorm:"size:255;default:null"`
	Description *string                `gorm:"default:null"`
	ParentID    mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	Tools       []Tool                 `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Tool struct {
	BaseModel
	Name        *string                `gorm:"size:255;default:null"`
	Description *string                `gorm:"default:null"`
	ParentID    mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	Operations  []Operation            `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Operation struct {
	BaseModel
	Name        *string                `gorm:"size:255;default:null"`
	Description *string                `gorm:"default:null"`
	ParentID    mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
}

type Version struct {
	VersionID   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key"`
	CreatedAt   time.Time              `gorm:"type:datetime2;index"`
	CreatedBy   *string                `gorm:"size:255;default:null"`
	Description *string                `gorm:"default:null"`
}

type LineHistory struct {
	HistoryPK   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key"`
	VersionID   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	ID          mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	CreatedAt   time.Time              `gorm:"type:datetime2"`
	UpdatedAt   time.Time              `gorm:"type:datetime2"`
	CreatedBy   *string                `gorm:"size:255"`
	UpdatedBy   *string                `gorm:"size:255"`
	Name        *string                `gorm:"size:255"`
	Description *string
}

type StationHistory struct {
	HistoryPK   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key"`
	VersionID   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	ID          mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	ParentID    mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	CreatedAt   time.Time              `gorm:"type:datetime2"`
	UpdatedAt   time.Time              `gorm:"type:datetime2"`
	CreatedBy   *string                `gorm:"size:255"`
	UpdatedBy   *string                `gorm:"size:255"`
	Name        *string                `gorm:"size:255"`
	Description *string
}

type ToolHistory struct {
	HistoryPK   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key"`
	VersionID   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	ID          mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	ParentID    mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	CreatedAt   time.Time              `gorm:"type:datetime2"`
	UpdatedAt   time.Time              `gorm:"type:datetime2"`
	CreatedBy   *string                `gorm:"size:255"`
	UpdatedBy   *string                `gorm:"size:255"`
	Name        *string                `gorm:"size:255"`
	Description *string
}

type OperationHistory struct {
	HistoryPK   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key"`
	VersionID   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	ID          mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	ParentID    mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	CreatedAt   time.Time              `gorm:"type:datetime2"`
	UpdatedAt   time.Time              `gorm:"type:datetime2"`
	CreatedBy   *string                `gorm:"size:255"`
	UpdatedBy   *string                `gorm:"size:255"`
	Name        *string                `gorm:"size:255"`
	Description *string
}

type AppMetadata struct {
	ConfigKey  string    `gorm:"primaryKey;size:50"`
	LastUpdate time.Time `gorm:"type:datetime2"`
}

type EntityChangeLog struct {
	LogID           mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key;default:newsequentialid()"` // MS SQL Default
	EntityID        mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	EntityType      string                 `gorm:"size:50;index"`
	OperationType   string                 `gorm:"size:20"`
	ChangeTime      time.Time              `gorm:"type:datetime2;index"` // GORM oder DB setzt dies. `default:GETDATE()` wäre auch eine Option
	ChangedByUserID *string                `gorm:"size:255;default:null"`
}

func (logEntry *EntityChangeLog) BeforeCreate(tx *gorm.DB) (err error) {
	var emptyID mssql.UniqueIdentifier
	if logEntry.LogID == emptyID {
		googleUUID := uuid.New()
		var newMsID mssql.UniqueIdentifier
		errScan := newMsID.Scan(googleUUID.String())
		if errScan != nil {
			log.Printf("Error converting google/uuid to mssql.UniqueIdentifier in EntityChangeLog.BeforeCreate: %v", errScan)
			return errScan
		}
		logEntry.LogID = newMsID
	}
	if logEntry.ChangeTime.IsZero() { // Setze ChangeTime, falls nicht schon gesetzt
		logEntry.ChangeTime = time.Now()
	}
	return
}
