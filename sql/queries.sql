-- internal/db/queries/queries.sql

-- name: CreateLine :one
INSERT INTO lines (name)
VALUES (?)
RETURNING *;

-- name: CreateStation :one
INSERT INTO stations (name, line_id)
VALUES (?, ?)
RETURNING *;

-- name: CreateTool :one
INSERT INTO tools (name, station_id)
VALUES (?, ?)
RETURNING *;

-- name: CreateOperation :one
INSERT INTO operations (name, tool_id)
VALUES (?, ?)
RETURNING *;

-- name: GetLineByID :one
SELECT * FROM lines
WHERE id = ?;

-- name: GetStationsByLineID :many
SELECT * FROM stations
WHERE line_id = ?;

-- name: GetToolsByStationID :many
SELECT * FROM tools
WHERE station_id = ?;

-- name: GetOperationsByToolID :many
SELECT * FROM operations
WHERE tool_id = ?;

-- name: ListLines :many
SELECT * FROM lines;

-- name: ListStations :many
SELECT * FROM stations;

-- name: ListTools :many
SELECT * FROM tools;

-- name: ListOperations :many
SELECT * FROM operations;
