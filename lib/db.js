import Database from "better-sqlite3";

const db = new Database("cep.db");

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      comment TEXT,
      create_state TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      comment TEXT,
      create_state TEXT,
      
      modified_date TEXT,
      last_user TEXT,
      line_id TEXT,

      number TEXT,
      type_id TEXT,
      state TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      comment TEXT,
      create_state TEXT,

      modified_date TEXT,
      last_user TEXT,
      station_id TEXT,

      shortname TEXT,
      description TEXT,
      ip_address TEXT,
      class_id TEXT,
      sps_id TEXT,
      type_id TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      comment TEXT,
      create_state TEXT,

      modified_date TEXT,
      last_user TEXT,
      tool_id TEXT,

      shortname TEXT,
      description TEXT,
      decision_criteria TEXT,
      sequence_group TEXT,
      always_perform TEXT,
      serial_or_paralel TEXT,
      eks_ip TEXT,
      template_id TEXT,
      q_gate_relevant_id TEXT,
      decision_class_id TEXT,
      saving_class_id TEXT,
      verification_class_id TEXT,
      general_class_id TEXT
    )
  `);
}

export default db;
