"use server"

import db from "../lib/db";
import { initializeDatabase } from "../lib/db";

// Params:
// entity: line, station, tool, operation
// parent_id: line_id, station_id, tool_id, operation_id
// id: id of the selected entity
// field: name/comment/create_state ...
// value: value of the field to be updated
// Returns: Selection or true if the operation was successful

export async function init() {

    initializeDatabase();
}

export async function getEntities(entity: string, parent_id: number) {
    
    let entities;

    switch (entity) {
        case "line":
            entities = await db.prepare("SELECT id, name, comment, create_state FROM lines").all();
            break;
        case "station":
            entities = await db.prepare("SELECT id, name, comment, create_state FROM stations WHERE line_id = (?)").all(parent_id);
            break;
        case "tool":
            entities = await db.prepare("SELECT id, name, comment, create_state FROM tools WHERE station_id = (?)").all(parent_id);
            break;
        case "operation":
            entities = await db.prepare("SELECT id, name, comment, create_state FROM operations WHERE tool_id = (?)").all(parent_id);
            break;
        default:
            throw new Error("Invalid entity type");
    }
    
    return entities;
}

export async function getEntityDetails(entity: string, id: number) {

    let entityDetails;

    switch (entity) {
        case "line":
            entityDetails = await db.prepare("SELECT * FROM lines WHERE id = (?)").get(id);
            break;
        case "station":
            entityDetails = await db.prepare("SELECT * FROM stations WHERE id = (?)").get(id);
            break;
        case "tool":
            entityDetails = await db.prepare("SELECT * FROM tools WHERE id = (?)").get(id);
            break;
        case "operation":
            entityDetails = await db.prepare("SELECT * FROM operations WHERE id = (?)").get(id);
            break;
        default:
            throw new Error("Invalid entity type");
    }
    
    return entityDetails;
}

export async function createEntity(entity: string, parent_id: number){    
    let result;
    switch (entity) {
        case "line":
            result = await db.prepare("INSERT INTO lines DEFAULT VALUES").run();
            break;
        case "station":
            result = await db.prepare("INSERT INTO stations (line_id) VALUES (?)").run(parent_id);
            break;
        case "tool":
            result = await db.prepare("INSERT INTO tools (station_id) VALUES (?)").run(parent_id);
            break;
        case "operation":
            result = await db.prepare("INSERT INTO operations (tool_id) VALUES (?)").run(parent_id);
            break;
        default:
            throw new Error("Invalid entity type");
    }
    return result.id;
}

export async function deleteEntity(entity: string, id: number) { 
    
    switch (entity) {
        case "line":
            await db.prepare("DELETE FROM lines WHERE id = (?)").run(id);
            break;
        case "station":
            await db.prepare("DELETE FROM stations WHERE id = (?)").run(id);
            break;
        case "tool":
            await db.prepare("DELETE FROM tools WHERE id = (?)").run(id);
            break;
        case "operation":
            await db.prepare("DELETE FROM operations WHERE id = (?)").run(id);
            break;
        default:
            throw new Error("Invalid entity type");
    }
    return true;
}

export async function updateEntity(entity: string, id: number, field: string, value: string | number) {

    switch (entity) {
        case "line":
            await db.prepare(`UPDATE lines SET ${field} = (?) WHERE id = (?)`).run(value, id);
            break;
        case "station":
            await db.prepare(`UPDATE stations SET ${field} = (?) WHERE id = (?)`).run(value, id);
            break;
        case "tool":
            await db.prepare(`UPDATE tools SET ${field} = (?) WHERE id = (?)`).run(value, id);
            break;
        case "operation":
            await db.prepare(`UPDATE operations SET ${field} = (?) WHERE id = (?)`).run(value, id);
            break;
        default:
            throw new Error("Invalid entity type");
    }
    return true;

}