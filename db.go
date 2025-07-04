package main

import (
	"log"
	"time"

	"github.com/google/uuid"
	mssql "github.com/microsoft/go-mssqldb"
	"gorm.io/gorm"
)

type BaseModel struct {
	Name        *string                `gorm:"size:255;default:null"`
	Comment     *string                `gorm:"default:null"`
	StatusColor *string                `gorm:"size:255;default:null"`
	ID          mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key"`
	CreatedAt   time.Time              `gorm:"type:datetime2"`
	UpdatedAt   time.Time              `gorm:"type:datetime2"`
	CreatedBy   *string                `gorm:"size:255;default:null"`
	UpdatedBy   *string                `gorm:"size:255;default:null"`
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
	AssemblyArea *string   `gorm:"size:3;default:null"`
	Stations     []Station `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Station struct {
	BaseModel
	Description    *string                `gorm:"default:null"`
	StationType    *string                `gorm:"default:null"`
	ParentID       mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	Tools          []Tool                 `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SequenceGroups []SequenceGroup        `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Tool struct {
	BaseModel
	ToolClass             *string                `gorm:"default:null"`
	ToolType              *string                `gorm:"default:null"`
	Description           *string                `gorm:"default:null"`
	IpAddressDevice       *string                `gorm:"default:null"`
	SPSPLCNameSPAService  *string                `gorm:"default:null"`
	SPSDBNoSend           *string                `gorm:"default:null"`
	SPSDBNoReceive        *string                `gorm:"default:null"`
	SPSPreCheck           *string                `gorm:"default:null"`
	SPSAddressInSendDB    *string                `gorm:"default:null"`
	SPSAddressInReceiveDB *string                `gorm:"default:null"`
	ParentID              mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	Operations            []Operation            `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Operation struct {
	BaseModel
	Description       *string                 `gorm:"default:null"`
	SerialOrParallel  *string                 `gorm:"default:null"`
	Sequence          *string                 `gorm:"default:null"`
	AlwaysPerform     *string                 `gorm:"default:null"`
	QGateRelevant     *string                 `gorm:"default:null"`
	Template          *string                 `gorm:"default:null"`
	DecisionClass     *string                 `gorm:"default:null"`
	VerificationClass *string                 `gorm:"default:null"`
	GenerationClass   *string                 `gorm:"default:null"`
	SavingClass       *string                 `gorm:"default:null"`
	DecisionCriteria  *string                 `gorm:"default:null"`
	ParentID          mssql.UniqueIdentifier  `gorm:"type:uniqueidentifier;index"`
	GroupID           *mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	SequenceGroup     *string                 `gorm:"default:null"`
}

type SequenceGroup struct {
	BaseModel
	ParentID   mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	Index      *string                `gorm:"size:255;default:null"`
	Operations []Operation            `gorm:"foreignKey:GroupID;"`
}

// History Models for Versioning
// These structs explicitly duplicate fields to store a snapshot of the entity at a point in time.

type LineHistory struct {
	Version      int                    `gorm:"primaryKey;autoIncrement:false"`
	EntityID     mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primaryKey"`
	Name         *string                `gorm:"size:255;default:null"`
	Comment      *string                `gorm:"default:null"`
	StatusColor  *string                `gorm:"size:255;default:null"`
	CreatedAt    time.Time              `gorm:"type:datetime2"`
	UpdatedAt    time.Time              `gorm:"type:datetime2"`
	CreatedBy    *string                `gorm:"size:255;default:null"`
	UpdatedBy    *string                `gorm:"size:255;default:null"`
	AssemblyArea *string                `gorm:"size:3;default:null"`
}

func (LineHistory) TableName() string { return "line_histories" }

type StationHistory struct {
	Version     int                    `gorm:"primaryKey;autoIncrement:false"`
	EntityID    mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primaryKey"`
	Name        *string                `gorm:"size:255;default:null"`
	Comment     *string                `gorm:"default:null"`
	StatusColor *string                `gorm:"size:255;default:null"`
	CreatedAt   time.Time              `gorm:"type:datetime2"`
	UpdatedAt   time.Time              `gorm:"type:datetime2"`
	CreatedBy   *string                `gorm:"size:255;default:null"`
	UpdatedBy   *string                `gorm:"size:255;default:null"`
	Description *string                `gorm:"default:null"`
	StationType *string                `gorm:"default:null"`
	ParentID    mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
}

func (StationHistory) TableName() string { return "station_histories" }

type ToolHistory struct {
	Version               int                    `gorm:"primaryKey;autoIncrement:false"`
	EntityID              mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primaryKey"`
	Name                  *string                `gorm:"size:255;default:null"`
	Comment               *string                `gorm:"default:null"`
	StatusColor           *string                `gorm:"size:255;default:null"`
	CreatedAt             time.Time              `gorm:"type:datetime2"`
	UpdatedAt             time.Time              `gorm:"type:datetime2"`
	CreatedBy             *string                `gorm:"size:255;default:null"`
	UpdatedBy             *string                `gorm:"size:255;default:null"`
	ToolClass             *string                `gorm:"default:null"`
	ToolType              *string                `gorm:"default:null"`
	Description           *string                `gorm:"default:null"`
	IpAddressDevice       *string                `gorm:"default:null"`
	SPSPLCNameSPAService  *string                `gorm:"default:null"`
	SPSDBNoSend           *string                `gorm:"default:null"`
	SPSDBNoReceive        *string                `gorm:"default:null"`
	SPSPreCheck           *string                `gorm:"default:null"`
	SPSAddressInSendDB    *string                `gorm:"default:null"`
	SPSAddressInReceiveDB *string                `gorm:"default:null"`
	ParentID              mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
}

func (ToolHistory) TableName() string { return "tool_histories" }

type OperationHistory struct {
	Version           int                    `gorm:"primaryKey;autoIncrement:false"`
	EntityID          mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primaryKey"`
	Name              *string                `gorm:"size:255;default:null"`
	Comment           *string                `gorm:"default:null"`
	StatusColor       *string                `gorm:"size:255;default:null"`
	CreatedAt         time.Time              `gorm:"type:datetime2"`
	UpdatedAt         time.Time              `gorm:"type:datetime2"`
	CreatedBy         *string                `gorm:"size:255;default:null"`
	UpdatedBy         *string                `gorm:"size:255;default:null"`
	Description       *string                `gorm:"default:null"`
	DecisionCriteria  *string                `gorm:"default:null"`
	SerialOrParallel  *string                `gorm:"default:null"`
	SequenceGroup     *string                `gorm:"default:null"`
	Sequence          *string                `gorm:"default:null"`
	AlwaysPerform     *string                `gorm:"default:null"`
	QGateRelevant     *string                `gorm:"default:null"`
	Template          *string                `gorm:"default:null"`
	DecisionClass     *string                `gorm:"default:null"`
	SavingClass       *string                `gorm:"default:null"`
	VerificationClass *string                `gorm:"default:null"`
	GenerationClass   *string                `gorm:"default:null"`
	ParentID          mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
}

func (OperationHistory) TableName() string { return "operation_histories" }

// --- End of History Models ---

type AppMetadata struct {
	ConfigKey  string    `gorm:"primaryKey;size:50"`
	LastUpdate time.Time `gorm:"type:datetime2"`
}

type EntityChangeLog struct {
	LogID           mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;primary_key;default:newsequentialid()"`
	EntityID        mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	EntityType      string                 `gorm:"size:50;index"`
	OperationType   string                 `gorm:"size:20"`
	ChangedFields   *string                `gorm:"default:null"`
	ChangeTime      time.Time              `gorm:"type:datetime2;index"`
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
	if logEntry.ChangeTime.IsZero() {
		logEntry.ChangeTime = time.Now()
	}
	return
}
