package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

func (q *Queries) ImportEntity(ctx context.Context, jsonData string) error {

	type BaseEntity struct {
		ID         string         `json:"id"`
		ParentID   sql.NullString `json:"parent_id"`
		EntityType sql.NullString `json:"entity_type"`
	}

	var base BaseEntity
	if err := json.Unmarshal([]byte(jsonData), &base); err != nil {
		return fmt.Errorf("JSON-Parse-Fehler: %w", err)
	}

	if base.ID == "" {
		return errors.New("ID fehlt im JSON-Objekt")
	}

	if !base.EntityType.Valid {
		return errors.New("EntityType fehlt im JSON-Objekt")
	}

	entityType := strings.ToLower(base.EntityType.String)

	if base.ParentID.Valid && base.ParentID.String != "" {
		if err := q.checkParentExists(ctx, base.ParentID.String); err != nil {
			return fmt.Errorf("Elternelement-Fehler: %w", err)
		}
	}

	switch entityType {
	case "line":
		return q.importLine(ctx, jsonData)
	case "operation":
		return q.importOperation(ctx, jsonData)
	case "station":
		return q.importStation(ctx, jsonData)
	case "tool":
		return q.importTool(ctx, jsonData)
	default:
		return fmt.Errorf("Unbekannter EntityType: %s", entityType)
	}
}

func (q *Queries) checkParentExists(ctx context.Context, parentID string) error {
	_, err1 := q.GetLineByID(ctx, parentID)
	if err1 == nil { return nil }

	_, err2 := q.GetOperationByID(ctx, parentID)
	if err2 == nil { return nil }

	_, err3 := q.GetStationByID(ctx, parentID)
	if err3 == nil { return nil }

	_, err4 := q.GetToolByID(ctx, parentID)
	if err4 == nil { return nil }

	return errors.New("ParentID existiert in keiner Tabelle")
}

func (q *Queries) importLine(ctx context.Context, jsonData string) error {
	var line Line
	if err := json.Unmarshal([]byte(jsonData), &line); err != nil {
		return fmt.Errorf("JSON-Unmarshal-Fehler (Line): %w", err)
	}
	_, err := q.GetLineByID(ctx, line.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			insertParams := InsertLineParams{
				ID:            line.ID,
				ParentID:      line.ParentID,
				EntityType:    line.EntityType,
				Name:          line.Name,
				Comment:       line.Comment,
				LastUser:      line.LastUser,
				ModifiedDate:  line.ModifiedDate,
				StatusColorID: line.StatusColorID,
			}
			return q.InsertLine(ctx, insertParams)
		}
		return fmt.Errorf("Fehler beim Prüfen der Line-Existenz: %w", err)
	}
	updateParams := UpdateLineParams{
		ID:            line.ID,
		ParentID:      line.ParentID,
		EntityType:    line.EntityType,
		Name:          line.Name,
		Comment:       line.Comment,
		LastUser:      line.LastUser,
		ModifiedDate:  line.ModifiedDate,
		StatusColorID: line.StatusColorID,
	}
	return q.UpdateLine(ctx, updateParams)
}

func (q *Queries) importOperation(ctx context.Context, jsonData string) error {
	var operation Operation
	if err := json.Unmarshal([]byte(jsonData), &operation); err != nil {
		return fmt.Errorf("JSON-Unmarshal-Fehler (Operation): %w", err)
	}
	_, err := q.GetOperationByID(ctx, operation.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			insertParams := InsertOperationParams{
				ID:                  operation.ID,
				ParentID:            operation.ParentID,
				EntityType:          operation.EntityType,
				ShortName:           operation.ShortName,
				Description:         operation.Description,
				DecisionCriteria:    operation.DecisionCriteria,
				SequenceGroup:       operation.SequenceGroup,
				Sequence:            operation.Sequence,
				AlwaysPerform:       operation.AlwaysPerform,
				Comment:             operation.Comment,
				LastUser:            operation.LastUser,
				ModifiedDate:        operation.ModifiedDate,
				QGateRelevantID:     operation.QGateRelevantID,
				DecisionClassID:     operation.DecisionClassID,
				SavingClassID:       operation.SavingClassID,
				VerificationClassID: operation.VerificationClassID,
				GenerationClassID:   operation.GenerationClassID,
				SerialOrParallelID:  operation.SerialOrParallelID,
				StatusColorID:       operation.StatusColorID,
			}
			return q.InsertOperation(ctx, insertParams)
		}
		return fmt.Errorf("Fehler beim Prüfen der Operation-Existenz: %w", err)
	}
	updateParams := UpdateOperationParams{
		ID:                  operation.ID,
		ParentID:            operation.ParentID,
		EntityType:          operation.EntityType,
		ShortName:           operation.ShortName,
		Description:         operation.Description,
		DecisionCriteria:    operation.DecisionCriteria,
		SequenceGroup:       operation.SequenceGroup,
		Sequence:            operation.Sequence,
		AlwaysPerform:       operation.AlwaysPerform,
		Comment:             operation.Comment,
		LastUser:            operation.LastUser,
		ModifiedDate:        operation.ModifiedDate,
		QGateRelevantID:     operation.QGateRelevantID,
		DecisionClassID:     operation.DecisionClassID,
		SavingClassID:       operation.SavingClassID,
		VerificationClassID: operation.VerificationClassID,
		GenerationClassID:   operation.GenerationClassID,
		SerialOrParallelID:  operation.SerialOrParallelID,
		StatusColorID:       operation.StatusColorID,
	}
	return q.UpdateOperation(ctx, updateParams)
}

func (q *Queries) importStation(ctx context.Context, jsonData string) error {
	var station Station
	if err := json.Unmarshal([]byte(jsonData), &station); err != nil {
		return fmt.Errorf("JSON-Unmarshal-Fehler (Station): %w", err)
	}
	_, err := q.GetStationByID(ctx, station.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			insertParams := InsertStationParams{
				ID:              station.ID,
				ParentID:        station.ParentID,
				EntityType:      station.EntityType,
				Number:          station.Number,
				NameDescription: station.NameDescription,
				Comment:         station.Comment,
				LastUser:        station.LastUser,
				ModifiedDate:    station.ModifiedDate,
				StationTypeID:   station.StationTypeID,
				StatusColorID:   station.StatusColorID,
			}
			return q.InsertStation(ctx, insertParams)
		}
		return fmt.Errorf("Fehler beim Prüfen der Station-Existenz: %w", err)
	}
	updateParams := UpdateStationParams{
		ID:              station.ID,
		ParentID:        station.ParentID,
		EntityType:      station.EntityType,
		Number:          station.Number,
		NameDescription: station.NameDescription,
		Comment:         station.Comment,
		LastUser:        station.LastUser,
		ModifiedDate:    station.ModifiedDate,
		StationTypeID:   station.StationTypeID,
		StatusColorID:   station.StatusColorID,
	}
	return q.UpdateStation(ctx, updateParams)
}

func (q *Queries) importTool(ctx context.Context, jsonData string) error {
	var tool Tool
	if err := json.Unmarshal([]byte(jsonData), &tool); err != nil {
		return fmt.Errorf("JSON-Unmarshal-Fehler (Tool): %w", err)
	}
	_, err := q.GetToolByID(ctx, tool.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			insertParams := InsertToolParams{
				ID:                    tool.ID,
				ParentID:              tool.ParentID,
				EntityType:            tool.EntityType,
				ShortName:             tool.ShortName,
				Description:           tool.Description,
				IpAddressDevice:       tool.IpAddressDevice,
				ToolWithSps:           tool.ToolWithSps,
				SpsPlcNameSpaService:  tool.SpsPlcNameSpaService,
				SpsDbNoSend:           tool.SpsDbNoSend,
				SpsDbNoReceive:        tool.SpsDbNoReceive,
				SpsPreCheckByte:       tool.SpsPreCheckByte,
				SpsAddressInSendDb:    tool.SpsAddressInSendDb,
				SpsAddressInReceiveDb: tool.SpsAddressInReceiveDb,
				Comment:               tool.Comment,
				LastUser:              tool.LastUser,
				ModifiedDate:          tool.ModifiedDate,
				ToolClassID:           tool.ToolClassID,
				ToolTypeID:            tool.ToolTypeID,
				StatusColorID:         tool.StatusColorID,
			}
			return q.InsertTool(ctx, insertParams)
		}
		return fmt.Errorf("Fehler beim Prüfen der Tool-Existenz: %w", err)
	}
	updateParams := UpdateToolParams{
		ID:                    tool.ID,
		ParentID:              tool.ParentID,
		EntityType:            tool.EntityType,
		ShortName:             tool.ShortName,
		Description:           tool.Description,
		IpAddressDevice:       tool.IpAddressDevice,
		ToolWithSps:           tool.ToolWithSps,
		SpsPlcNameSpaService:  tool.SpsPlcNameSpaService,
		SpsDbNoSend:           tool.SpsDbNoSend,
		SpsDbNoReceive:        tool.SpsDbNoReceive,
		SpsPreCheckByte:       tool.SpsPreCheckByte,
		SpsAddressInSendDb:    tool.SpsAddressInSendDb,
		SpsAddressInReceiveDb: tool.SpsAddressInReceiveDb,
		Comment:               tool.Comment,
		LastUser:              tool.LastUser,
		ModifiedDate:          tool.ModifiedDate,
		ToolClassID:           tool.ToolClassID,
		ToolTypeID:            tool.ToolTypeID,
		StatusColorID:         tool.StatusColorID,
	}
	return q.UpdateTool(ctx, updateParams)
}

func (q *Queries) ImportFromClipboard(ctx context.Context, clipboardData string) error {
	var jsonData interface{}
	if err := json.Unmarshal([]byte(clipboardData), &jsonData); err != nil {
		return fmt.Errorf("Ungültiges JSON in der Zwischenablage: %w", err)
	}
	switch data := jsonData.(type) {
	case []interface{}:								//fällt wahrscheinlich weg
		for i, item := range data {
			itemJSON, err := json.Marshal(item)
			if err != nil {
				return fmt.Errorf("Fehler beim Serialisieren des Items %d: %w", i, err)
			}
			if err := q.ImportEntity(ctx, string(itemJSON)); err != nil {
				return fmt.Errorf("Fehler beim Importieren des Items %d: %w", i, err)
			}
		}
	case map[string]interface{}:
		return q.ImportEntity(ctx, clipboardData)
	default:
		return errors.New("Unbekanntes JSON-Format in der Zwischenablage")
	}

	return nil
}