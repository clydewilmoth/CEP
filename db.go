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
	Description      *string                `gorm:"default:null"`
	StationType      *string                `gorm:"default:null"`
	SerialOrParallel *string                `gorm:"default:null"`
	ParentID         mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
	Tools            []Tool                 `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Tool struct {
	BaseModel
	ToolClass             *string                `gorm:"default:null"`
	ToolType              *string                `gorm:"default:null"`
	Description           *string                `gorm:"default:null"`
	IpAddressDevice       *string                `gorm:"default:null"`
	ToolWithSPS           *string                `gorm:"default:null"`
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
	Description        *string                `gorm:"default:null"`
	DecisionCriteria   *string                `gorm:"default:null"`
	SequenceGroup      *string                `gorm:"default:null"`
	Sequence           *string                `gorm:"default:null"`
	AlwaysPerform      *string                `gorm:"default:null"`
	QGateRelevant      *string                `gorm:"default:null"`
	TemplateId         *string                `gorm:"default:null"`
	DecisionClass      *string                `gorm:"default:null"`
	SavingClass        *string                `gorm:"default:null"`
	VerificationClass  *string                `gorm:"default:null"`
	GenerationClass    *string                `gorm:"default:null"`
	OperationDecisions *string                `gorm:"default:null"`
	ParentID           mssql.UniqueIdentifier `gorm:"type:uniqueidentifier;index"`
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
	if logEntry.ChangeTime.IsZero() {
		logEntry.ChangeTime = time.Now()
	}
	return
}
