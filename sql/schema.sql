-- schema.sql

CREATE TABLE lines (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  entity_type TEXT,
  name TEXT,
  comment TEXT,
  last_user TEXT,
  modified_date TEXT,
  status_color_id TEXT
);

CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  entity_type TEXT,
  number TEXT,
  name_description TEXT,
  comment TEXT,
  last_user TEXT,
  modified_date TEXT,
  station_type_id TEXT,
  status_color_id TEXT,
  FOREIGN KEY (parent_id) REFERENCES lines(id) ON DELETE CASCADE
);

CREATE TABLE tools (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  entity_type TEXT,
  short_name TEXT,
  description TEXT,
  ip_address_device TEXT,
  tool_with_sps TEXT,
  sps_plc_name_spa_service TEXT,
  sps_db_no_send TEXT,
  sps_db_no_receive TEXT,
  sps_pre_check_byte TEXT,
  sps_address_in_send_db TEXT,
  sps_address_in_receive_db TEXT,
  comment TEXT,
  last_user TEXT,
  modified_date TEXT,
  tool_class_id TEXT,
  tool_type_id TEXT,
  status_color_id TEXT,
  FOREIGN KEY (parent_id) REFERENCES stations(id) ON DELETE CASCADE
);

CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  entity_type TEXT,
  short_name TEXT,
  description TEXT,
  decision_criteria TEXT,
  sequence_group TEXT,
  sequence TEXT,
  always_perform TEXT,
  comment TEXT,
  last_user TEXT,
  modified_date TEXT,
  q_gate_relevant_id TEXT,
  decision_class_id TEXT,
  saving_class_id TEXT,
  verification_class_id TEXT,
  generation_class_id TEXT,
  serial_or_parallel_id TEXT,
  status_color_id TEXT,
  FOREIGN KEY (parent_id) REFERENCES tools(id) ON DELETE CASCADE
);
