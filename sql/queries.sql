-- queries.sql

-- LINE QUERIES

-- name: GetLineByID :one
SELECT * FROM lines WHERE id = ?;

-- name: InsertLine :exec
INSERT INTO lines (id, parent_id, entity_type, name, comment, last_user, modified_date, status_color_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateLine :exec
UPDATE lines
SET parent_id = ?, entity_type = ?, name = ?, comment = ?, last_user = ?, modified_date = ?, status_color_id = ?
WHERE id = ?;

-- STATION QUERIES

-- name: GetStationByID :one
SELECT * FROM stations WHERE id = ?;

-- name: InsertStation :exec
INSERT INTO stations (id, parent_id, entity_type, number, name_description, comment, last_user, modified_date, station_type_id, status_color_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateStation :exec
UPDATE stations
SET parent_id = ?, entity_type = ?, number = ?, name_description = ?, comment = ?, last_user = ?, modified_date = ?, station_type_id = ?, status_color_id = ?
WHERE id = ?;

-- TOOL QUERIES

-- name: GetToolByID :one
SELECT * FROM tools WHERE id = ?;

-- name: InsertTool :exec
INSERT INTO tools (id, parent_id, entity_type, short_name, description, ip_address_device, tool_with_sps, sps_plc_name_spa_service, sps_db_no_send, sps_db_no_receive, sps_pre_check_byte, sps_address_in_send_db, sps_address_in_receive_db, comment, last_user, modified_date, tool_class_id, tool_type_id, status_color_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateTool :exec
UPDATE tools
SET parent_id = ?, entity_type = ?, short_name = ?, description = ?, ip_address_device = ?, tool_with_sps = ?, sps_plc_name_spa_service = ?, sps_db_no_send = ?, sps_db_no_receive = ?, sps_pre_check_byte = ?, sps_address_in_send_db = ?, sps_address_in_receive_db = ?, comment = ?, last_user = ?, modified_date = ?, tool_class_id = ?, tool_type_id = ?, status_color_id = ?
WHERE id = ?;

-- OPERATION QUERIES

-- name: GetOperationByID :one
SELECT * FROM operations WHERE id = ?;

-- name: InsertOperation :exec
INSERT INTO operations (id, parent_id, entity_type, short_name, description, decision_criteria, sequence_group, sequence, always_perform, comment, last_user, modified_date, q_gate_relevant_id, decision_class_id, saving_class_id, verification_class_id, generation_class_id, serial_or_parallel_id, status_color_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateOperation :exec
UPDATE operations
SET parent_id = ?, entity_type = ?, short_name = ?, description = ?, decision_criteria = ?, sequence_group = ?, sequence = ?, always_perform = ?, comment = ?, last_user = ?, modified_date = ?, q_gate_relevant_id = ?, decision_class_id = ?, saving_class_id = ?, verification_class_id = ?, generation_class_id = ?, serial_or_parallel_id = ?, status_color_id = ?
WHERE id = ?;
