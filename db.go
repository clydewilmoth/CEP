package main

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uuid.UUID `gorm:"type:uniqueidentifier;primary_key"`
	CreatedAt time.Time `gorm:"type:datetime2"`
	UpdatedAt time.Time `gorm:"type:datetime2"`
	CreatedBy *string   `gorm:"size:255;default:null"`
	UpdatedBy *string   `gorm:"size:255;default:null"`
}

func (base *BaseModel) BeforeCreate(tx *gorm.DB) (err error) {
	if base.ID == uuid.Nil {
		base.ID = uuid.New()
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
	Name        *string   `gorm:"size:255;default:null"`
	Description *string   `gorm:"default:null"`
	ParentID    uuid.UUID `gorm:"type:uniqueidentifier;index"`
	Tools       []Tool    `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Tool struct {
	BaseModel
	Name        *string     `gorm:"size:255;default:null"`
	Description *string     `gorm:"default:null"`
	ParentID    uuid.UUID   `gorm:"type:uniqueidentifier;index"`
	Operations  []Operation `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Operation struct {
	BaseModel
	Name        *string   `gorm:"size:255;default:null"`
	Description *string   `gorm:"default:null"`
	ParentID    uuid.UUID `gorm:"type:uniqueidentifier;index"`
}

type Version struct {
	VersionID   uuid.UUID `gorm:"type:uniqueidentifier;primary_key"`
	CreatedAt   time.Time `gorm:"type:datetime2;index"`
	CreatedBy   *string   `gorm:"size:255;default:null"`
	Description *string   `gorm:"default:null"`
}

type LineHistory struct {
	HistoryPK   uuid.UUID `gorm:"type:uniqueidentifier;primary_key"`
	VersionID   uuid.UUID `gorm:"type:uniqueidentifier;index"`
	ID          uuid.UUID `gorm:"type:uniqueidentifier;index"`
	CreatedAt   time.Time `gorm:"type:datetime2"`
	UpdatedAt   time.Time `gorm:"type:datetime2"`
	CreatedBy   *string   `gorm:"size:255"`
	UpdatedBy   *string   `gorm:"size:255"`
	Name        *string   `gorm:"size:255"`
	Description *string
}

type StationHistory struct {
	HistoryPK   uuid.UUID `gorm:"type:uniqueidentifier;primary_key"`
	VersionID   uuid.UUID `gorm:"type:uniqueidentifier;index"`
	ID          uuid.UUID `gorm:"type:uniqueidentifier;index"`
	ParentID    uuid.UUID `gorm:"type:uniqueidentifier;index"`
	CreatedAt   time.Time `gorm:"type:datetime2"`
	UpdatedAt   time.Time `gorm:"type:datetime2"`
	CreatedBy   *string   `gorm:"size:255"`
	UpdatedBy   *string   `gorm:"size:255"`
	Name        *string   `gorm:"size:255"`
	Description *string
}

type ToolHistory struct {
	HistoryPK   uuid.UUID `gorm:"type:uniqueidentifier;primary_key"`
	VersionID   uuid.UUID `gorm:"type:uniqueidentifier;index"`
	ID          uuid.UUID `gorm:"type:uniqueidentifier;index"`
	ParentID    uuid.UUID `gorm:"type:uniqueidentifier;index"`
	CreatedAt   time.Time `gorm:"type:datetime2"`
	UpdatedAt   time.Time `gorm:"type:datetime2"`
	CreatedBy   *string   `gorm:"size:255"`
	UpdatedBy   *string   `gorm:"size:255"`
	Name        *string   `gorm:"size:255"`
	Description *string
}

type OperationHistory struct {
	HistoryPK   uuid.UUID `gorm:"type:uniqueidentifier;primary_key"`
	VersionID   uuid.UUID `gorm:"type:uniqueidentifier;index"`
	ID          uuid.UUID `gorm:"type:uniqueidentifier;index"`
	ParentID    uuid.UUID `gorm:"type:uniqueidentifier;index"`
	CreatedAt   time.Time `gorm:"type:datetime2"`
	UpdatedAt   time.Time `gorm:"type:datetime2"`
	CreatedBy   *string   `gorm:"size:255"`
	UpdatedBy   *string   `gorm:"size:255"`
	Name        *string   `gorm:"size:255"`
	Description *string
}

type AppMetadata struct {
	Key        string    `gorm:"primaryKey;size:50"`
	LastUpdate time.Time `gorm:"type:datetime2"`
}

type EntityChangeLog struct {
	LogID           uuid.UUID `gorm:"type:uniqueidentifier;primary_key"`
	EntityID        uuid.UUID `gorm:"type:uniqueidentifier;index"`
	EntityType      string    `gorm:"size:50;index"`
	OperationType   string    `gorm:"size:20"`
	ChangeTime      time.Time `gorm:"type:datetime2;index"`
	ChangedByUserID *string   `gorm:"size:255;default:null"`
}
