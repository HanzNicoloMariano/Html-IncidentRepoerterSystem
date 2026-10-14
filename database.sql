-- Incident Reporting System database (generated from schema.js)
CREATE DATABASE IF NOT EXISTS incident_reporting_system;
USE incident_reporting_system;

-- Lookup: user roles
CREATE TABLE roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
);

-- Lookup: departments
CREATE TABLE departments (
  department_id INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(10) NOT NULL
);

-- People who report incidents
CREATE TABLE reporters (
  reporter_id INT AUTO_INCREMENT PRIMARY KEY,
  id_number VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  department_id INT,
  position VARCHAR(80),
  contact_number VARCHAR(30),
  email VARCHAR(100),
  address VARCHAR(255),
  reporter_type VARCHAR(20) NOT NULL,
  status VARCHAR(10) NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- System accounts
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  role_id INT NOT NULL,
  department_id INT,
  reporter_id INT,
  status VARCHAR(10) NOT NULL,
  must_change BOOLEAN,
  FOREIGN KEY (role_id) REFERENCES roles(role_id),
  FOREIGN KEY (department_id) REFERENCES departments(department_id),
  FOREIGN KEY (reporter_id) REFERENCES reporters(reporter_id)
);

-- Lookup: categories
CREATE TABLE incident_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(60) NOT NULL UNIQUE,
  status VARCHAR(10) NOT NULL
);

-- Lookup: types per category
CREATE TABLE incident_types (
  type_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  type_name VARCHAR(80) NOT NULL,
  status VARCHAR(10) NOT NULL,
  FOREIGN KEY (category_id) REFERENCES incident_categories(category_id)
);

-- Where incidents happen
CREATE TABLE locations (
  location_id INT AUTO_INCREMENT PRIMARY KEY,
  building VARCHAR(80) NOT NULL,
  room VARCHAR(80),
  area VARCHAR(80),
  department_id INT,
  floor VARCHAR(20),
  description VARCHAR(255),
  status VARCHAR(10) NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- The main incident record
CREATE TABLE incidents (
  incident_id INT AUTO_INCREMENT PRIMARY KEY,
  incident_number VARCHAR(20) NOT NULL UNIQUE,
  reporter_id INT NOT NULL,
  category_id INT NOT NULL,
  type_id INT NOT NULL,
  location_id INT NOT NULL,
  incident_date DATE NOT NULL,
  incident_time TIME NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(10) NOT NULL,
  immediate_response TEXT,
  status VARCHAR(20) NOT NULL,
  date_reported DATE NOT NULL,
  closure_date DATE,
  closed_by INT,
  FOREIGN KEY (reporter_id) REFERENCES reporters(reporter_id),
  FOREIGN KEY (category_id) REFERENCES incident_categories(category_id),
  FOREIGN KEY (type_id) REFERENCES incident_types(type_id),
  FOREIGN KEY (location_id) REFERENCES locations(location_id),
  FOREIGN KEY (closed_by) REFERENCES users(user_id)
);

-- Files attached to an incident
CREATE TABLE incident_attachments (
  attachment_id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size INT,
  uploaded_by INT,
  uploaded_at DATE,
  FOREIGN KEY (incident_id) REFERENCES incidents(incident_id),
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

-- Investigation of an incident
CREATE TABLE investigations (
  investigation_id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL UNIQUE,
  investigator_id INT NOT NULL,
  assigned_by INT,
  assigned_date DATE NOT NULL,
  start_date DATE NOT NULL,
  target_date DATE NOT NULL,
  completion_date DATE,
  status VARCHAR(25) NOT NULL,
  instructions TEXT,
  notes TEXT,
  FOREIGN KEY (incident_id) REFERENCES incidents(incident_id),
  FOREIGN KEY (investigator_id) REFERENCES users(user_id),
  FOREIGN KEY (assigned_by) REFERENCES users(user_id)
);

-- Findings and root cause
CREATE TABLE investigation_findings (
  finding_id INT AUTO_INCREMENT PRIMARY KEY,
  investigation_id INT NOT NULL UNIQUE,
  findings TEXT,
  witnesses TEXT,
  recommendation TEXT,
  rca_problem TEXT,
  rca_cause TEXT,
  rca_evidence TEXT,
  immediate_cause TEXT,
  root_cause TEXT,
  contributing_factors TEXT,
  preventive_measures TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id)
);

-- Evidence files
CREATE TABLE investigation_evidence (
  evidence_id INT AUTO_INCREMENT PRIMARY KEY,
  investigation_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size INT,
  description VARCHAR(255),
  uploaded_by INT,
  uploaded_at DATE,
  FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id),
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

-- Corrective / preventive actions
CREATE TABLE actions (
  action_id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL,
  investigation_id INT NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  description TEXT NOT NULL,
  responsible_id INT NOT NULL,
  target_date DATE NOT NULL,
  priority VARCHAR(10) NOT NULL,
  status VARCHAR(15) NOT NULL,
  completion_date DATE,
  is_required BOOLEAN,
  remarks TEXT,
  FOREIGN KEY (incident_id) REFERENCES incidents(incident_id),
  FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id),
  FOREIGN KEY (responsible_id) REFERENCES users(user_id)
);

-- History of action status changes
CREATE TABLE action_monitoring (
  monitor_id INT AUTO_INCREMENT PRIMARY KEY,
  action_id INT NOT NULL,
  old_status VARCHAR(15),
  new_status VARCHAR(15) NOT NULL,
  remarks TEXT,
  changed_by INT,
  changed_at DATE,
  FOREIGN KEY (action_id) REFERENCES actions(action_id),
  FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

-- How the incident was resolved
CREATE TABLE resolutions (
  resolution_id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL UNIQUE,
  resolution_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  resolution_date DATE NOT NULL,
  resolved_by INT NOT NULL,
  remarks TEXT,
  supporting_document VARCHAR(255),
  FOREIGN KEY (incident_id) REFERENCES incidents(incident_id),
  FOREIGN KEY (resolved_by) REFERENCES users(user_id)
);

-- Messages to users
CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  incident_id INT,
  created_at DATE,
  is_read BOOLEAN,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
);

-- Audit trail
CREATE TABLE audit_logs (
  audit_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  activity VARCHAR(100) NOT NULL,
  incident_id INT,
  previous_value TEXT,
  new_value TEXT,
  action_performed VARCHAR(20),
  logged_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
);

CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_incident_date ON incidents(incident_date);
CREATE INDEX idx_incidents_reporter_id ON incidents(reporter_id);
CREATE INDEX idx_incidents_location_id ON incidents(location_id);
CREATE INDEX idx_investigations_investigator_id ON investigations(investigator_id);
CREATE INDEX idx_actions_responsible_id ON actions(responsible_id);
CREATE INDEX idx_actions_target_date ON actions(target_date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_audit_logs_incident_id ON audit_logs(incident_id);

-- Initial reference data
INSERT INTO roles (role_name, description) VALUES
  ('Administrator', 'Manage system'),
  ('Reporter', 'Report incidents'),
  ('Incident Officer', 'Manage incident records'),
  ('Investigator', 'Investigate incidents'),
  ('Action Officer', 'Implement corrective actions'),
  ('Supervisor', 'Review and approve'),
  ('Management', 'View reports and dashboards');
INSERT INTO departments (department_name, status) VALUES
  ('IT Department', 'Active'),
  ('Facilities', 'Active'),
  ('Security Office', 'Active'),
  ('Human Resources', 'Active'),
  ('Student Affairs', 'Active'),
  ('Library', 'Active'),
  ('Administration', 'Active');
INSERT INTO incident_categories (category_name, status) VALUES
  ('Safety', 'Active'),
  ('Security', 'Active'),
  ('Accident', 'Active'),
  ('Property Damage', 'Active'),
  ('Workplace', 'Active'),
  ('IT/Technical', 'Active'),
  ('Environmental', 'Active'),
  ('Health', 'Active'),
  ('Other', 'Active');
INSERT INTO incident_types (category_id, type_name, status) VALUES
  (1, 'Slip/Fall', 'Active'),
  (1, 'Equipment Failure', 'Active'),
  (1, 'Equipment Accident', 'Active'),
  (1, 'Fire', 'Active'),
  (2, 'Theft', 'Active'),
  (2, 'Unauthorized Access', 'Active'),
  (3, 'Vehicle Accident', 'Active'),
  (4, 'Vandalism', 'Active'),
  (4, 'Equipment Damage', 'Active'),
  (5, 'Harassment Complaint', 'Active'),
  (5, 'Workplace Conflict', 'Active'),
  (6, 'Data Incident', 'Active'),
  (6, 'System Outage', 'Active'),
  (7, 'Chemical Spill', 'Active'),
  (7, 'Waste Mismanagement', 'Active'),
  (8, 'Physical Injury', 'Active'),
  (8, 'Illness Outbreak', 'Active'),
  (9, 'Other Incident', 'Active');
