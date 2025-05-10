package main

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (base *BaseModel) BeforeCreate(tx *gorm.DB) (err error) {
	if base.ID == uuid.Nil {
		base.ID = uuid.New()
	}
	return
}

type Line struct {
	BaseModel
	Name        string    `gorm:"size:255;default:null"`
	Description string    `gorm:"default:null"`
	Stations    []Station `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Station struct {
	BaseModel
	Name        string    `gorm:"size:255;default:null"`
	Description string    `gorm:"default:null"`
	ParentID    uuid.UUID `gorm:"type:uuid;index;comment:ID of the parent Line"`
	Tools       []Tool    `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Tool struct {
	BaseModel
	Name        string      `gorm:"size:255;default:null"`
	Description string      `gorm:"default:null"`
	ParentID    uuid.UUID   `gorm:"type:uuid;index;comment:ID of the parent Station"`
	Operations  []Operation `gorm:"foreignKey:ParentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Operation struct {
	BaseModel
	Name        string    `gorm:"size:255;default:null"`
	Description string    `gorm:"default:null"`
	ParentID    uuid.UUID `gorm:"type:uuid;index;comment:ID of the parent Tool"`
}
