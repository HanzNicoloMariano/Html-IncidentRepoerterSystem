"use strict";
/* =====================================================================
   schema.js - DATABASE DESIGN (Labs 2 and 3)
   One place that describes every table. The ERD, the data dictionary
   and database.sql are all generated from this list.
   Field format: [name, SQL type, constraints, description]
   Constraints: PK = primary key, UQ = unique, NN = not null, FK:table.column
   ===================================================================== */
const SCHEMA = [
  { name: "roles", note: "Lookup: user roles", fields: [
    ["role_id", "INT", "PK", "Unique role ID"],
    ["role_name", "VARCHAR(50)", "NN UQ", "Role name"],
    ["description", "VARCHAR(255)", "", "Responsibility of the role"]] },
  { name: "departments", note: "Lookup: departments", fields: [
    ["department_id", "INT", "PK", "Unique department ID"],
    ["department_name", "VARCHAR(100)", "NN UQ", "Department name"],
    ["status", "VARCHAR(10)", "NN", "Active / Inactive"]] },
  { name: "reporters", note: "People who report incidents", fields: [
    ["reporter_id", "INT", "PK", "Unique reporter ID"],
    ["id_number", "VARCHAR(30)", "NN UQ", "Employee/Student ID"],
    ["full_name", "VARCHAR(100)", "NN", "Full name"],
    ["department_id", "INT", "FK:departments.department_id", "Department"],
    ["position", "VARCHAR(80)", "", "Position / year level"],
    ["contact_number", "VARCHAR(30)", "", "Contact number"],
    ["email", "VARCHAR(100)", "", "Email address"],
    ["address", "VARCHAR(255)", "", "Home address"],
    ["reporter_type", "VARCHAR(20)", "NN", "Employee, Student, Visitor, Contractor"],
    ["status", "VARCHAR(10)", "NN", "Active / Inactive"]] },
  { name: "users", note: "System accounts", fields: [
    ["user_id", "INT", "PK", "Unique user ID"],
    ["username", "VARCHAR(50)", "NN UQ", "Login name"],
    ["password_hash", "VARCHAR(255)", "NN", "Scrambled password (never plain text)"],
    ["full_name", "VARCHAR(100)", "NN", "Full name"],
    ["email", "VARCHAR(100)", "", "Email (used for password reset)"],
    ["role_id", "INT", "NN FK:roles.role_id", "User role"],
    ["department_id", "INT", "FK:departments.department_id", "Department"],
    ["reporter_id", "INT", "FK:reporters.reporter_id", "Linked reporter record (Reporter role)"],
    ["status", "VARCHAR(10)", "NN", "Active / Inactive"],
    ["must_change", "BOOLEAN", "", "True after a password reset"]] },
  { name: "incident_categories", note: "Lookup: categories", fields: [
    ["category_id", "INT", "PK", "Unique category ID"],
    ["category_name", "VARCHAR(60)", "NN UQ", "Safety, Security, Accident..."],
    ["status", "VARCHAR(10)", "NN", "Active / Inactive"]] },
  { name: "incident_types", note: "Lookup: types per category", fields: [
    ["type_id", "INT", "PK", "Unique type ID"],
    ["category_id", "INT", "NN FK:incident_categories.category_id", "Category the type belongs to"],
    ["type_name", "VARCHAR(80)", "NN", "Slip/Fall, Theft, Fire..."],
    ["status", "VARCHAR(10)", "NN", "Active / Inactive"]] },
  { name: "locations", note: "Where incidents happen", fields: [
    ["location_id", "INT", "PK", "Unique location ID"],
    ["building", "VARCHAR(80)", "NN", "Building"],
    ["room", "VARCHAR(80)", "", "Room / office"],
    ["area", "VARCHAR(80)", "", "Area"],
    ["department_id", "INT", "FK:departments.department_id", "Responsible department"],
    ["floor", "VARCHAR(20)", "", "Floor"],
    ["description", "VARCHAR(255)", "", "Location description"],
    ["status", "VARCHAR(10)", "NN", "Active / Inactive"]] },
  { name: "incidents", note: "The main incident record", fields: [
    ["incident_id", "INT", "PK", "Unique incident ID"],
    ["incident_number", "VARCHAR(20)", "NN UQ", "Example: IN-2026-0001"],
    ["reporter_id", "INT", "NN FK:reporters.reporter_id", "Who reported it"],
    ["category_id", "INT", "NN FK:incident_categories.category_id", "Category"],
    ["type_id", "INT", "NN FK:incident_types.type_id", "Type"],
    ["location_id", "INT", "NN FK:locations.location_id", "Where it happened"],
    ["incident_date", "DATE", "NN", "Date it happened"],
    ["incident_time", "TIME", "NN", "Time it happened"],
    ["description", "TEXT", "NN", "What happened"],
    ["severity", "VARCHAR(10)", "NN", "Low, Medium, High, Critical"],
    ["immediate_response", "TEXT", "", "What was done right away"],
    ["status", "VARCHAR(20)", "NN", "Open, Under Investigation, For Action, Resolved, Closed"],
    ["date_reported", "DATE", "NN", "Date it was reported"],
    ["closure_date", "DATE", "", "Date closed"],
    ["closed_by", "INT", "FK:users.user_id", "Who closed it"]] },
  { name: "incident_attachments", note: "Files attached to an incident", fields: [
    ["attachment_id", "INT", "PK", "Unique attachment ID"],
    ["incident_id", "INT", "NN FK:incidents.incident_id", "Incident"],
    ["file_name", "VARCHAR(255)", "NN", "File name"],
    ["file_type", "VARCHAR(50)", "", "File type"],
    ["file_size", "INT", "", "Size in bytes"],
    ["uploaded_by", "INT", "FK:users.user_id", "Uploader"],
    ["uploaded_at", "DATE", "", "Upload date"]] },
  { name: "investigations", note: "Investigation of an incident", fields: [
    ["investigation_id", "INT", "PK", "Unique investigation ID"],
    ["incident_id", "INT", "NN UQ FK:incidents.incident_id", "Incident being investigated"],
    ["investigator_id", "INT", "NN FK:users.user_id", "Assigned investigator"],
    ["assigned_by", "INT", "FK:users.user_id", "Who assigned it"],
    ["assigned_date", "DATE", "NN", "Assignment date"],
    ["start_date", "DATE", "NN", "Start date"],
    ["target_date", "DATE", "NN", "Target completion date"],
    ["completion_date", "DATE", "", "Actual completion date"],
    ["status", "VARCHAR(25)", "NN", "Assigned, In Progress, Evidence Gathering, Findings Prepared, Completed"],
    ["instructions", "TEXT", "", "Instructions to the investigator"],
    ["notes", "TEXT", "", "Investigation notes"]] },
  { name: "investigation_findings", note: "Findings and root cause", fields: [
    ["finding_id", "INT", "PK", "Unique finding ID"],
    ["investigation_id", "INT", "NN UQ FK:investigations.investigation_id", "Investigation"],
    ["findings", "TEXT", "", "What was found"],
    ["witnesses", "TEXT", "", "Witnesses"],
    ["recommendation", "TEXT", "", "Investigator recommendation"],
    ["rca_problem", "TEXT", "", "RCA: Problem"],
    ["rca_cause", "TEXT", "", "RCA: Cause"],
    ["rca_evidence", "TEXT", "", "RCA: Evidence"],
    ["immediate_cause", "TEXT", "", "Immediate cause"],
    ["root_cause", "TEXT", "", "Root cause"],
    ["contributing_factors", "TEXT", "", "Contributing factors"],
    ["preventive_measures", "TEXT", "", "Recommended preventive measures"]] },
  { name: "investigation_evidence", note: "Evidence files", fields: [
    ["evidence_id", "INT", "PK", "Unique evidence ID"],
    ["investigation_id", "INT", "NN FK:investigations.investigation_id", "Investigation"],
    ["file_name", "VARCHAR(255)", "NN", "File name"],
    ["file_type", "VARCHAR(50)", "", "File type"],
    ["file_size", "INT", "", "Size in bytes"],
    ["description", "VARCHAR(255)", "", "What the evidence shows"],
    ["uploaded_by", "INT", "FK:users.user_id", "Uploader"],
    ["uploaded_at", "DATE", "", "Upload date"]] },
  { name: "actions", note: "Corrective / preventive actions", fields: [
    ["action_id", "INT", "PK", "Unique action ID"],
    ["incident_id", "INT", "NN FK:incidents.incident_id", "Incident"],
    ["investigation_id", "INT", "NN FK:investigations.investigation_id", "Investigation it is based on"],
    ["action_type", "VARCHAR(40)", "NN", "Corrective, Preventive, Training..."],
    ["description", "TEXT", "NN", "What must be done"],
    ["responsible_id", "INT", "NN FK:users.user_id", "Responsible person"],
    ["target_date", "DATE", "NN", "Deadline"],
    ["priority", "VARCHAR(10)", "NN", "Low, Medium, High, Critical"],
    ["status", "VARCHAR(15)", "NN", "Pending, In Progress, Completed, Verified"],
    ["completion_date", "DATE", "", "Completion date"],
    ["is_required", "BOOLEAN", "", "Must be completed before resolution"],
    ["remarks", "TEXT", "", "Remarks"]] },
  { name: "action_monitoring", note: "History of action status changes", fields: [
    ["monitor_id", "INT", "PK", "Unique ID"],
    ["action_id", "INT", "NN FK:actions.action_id", "Action"],
    ["old_status", "VARCHAR(15)", "", "Previous status"],
    ["new_status", "VARCHAR(15)", "NN", "New status"],
    ["remarks", "TEXT", "", "Remarks"],
    ["changed_by", "INT", "FK:users.user_id", "Who changed it"],
    ["changed_at", "DATE", "", "Date changed"]] },
  { name: "resolutions", note: "How the incident was resolved", fields: [
    ["resolution_id", "INT", "PK", "Unique resolution ID"],
    ["incident_id", "INT", "NN UQ FK:incidents.incident_id", "Incident"],
    ["resolution_type", "VARCHAR(50)", "NN", "Type of resolution"],
    ["description", "TEXT", "NN", "Resolution description"],
    ["resolution_date", "DATE", "NN", "Resolution date"],
    ["resolved_by", "INT", "NN FK:users.user_id", "Who recorded it"],
    ["remarks", "TEXT", "", "Remarks"],
    ["supporting_document", "VARCHAR(255)", "", "Supporting document name"]] },
  { name: "notifications", note: "Messages to users", fields: [
    ["notification_id", "INT", "PK", "Unique ID"],
    ["user_id", "INT", "NN FK:users.user_id", "Who receives it"],
    ["message", "VARCHAR(255)", "NN", "Message"],
    ["incident_id", "INT", "FK:incidents.incident_id", "Related incident"],
    ["created_at", "DATE", "", "Date"],
    ["is_read", "BOOLEAN", "", "Already read?"]] },
  { name: "audit_logs", note: "Audit trail", fields: [
    ["audit_id", "INT", "PK", "Unique ID"],
    ["user_id", "INT", "FK:users.user_id", "Who did it"],
    ["activity", "VARCHAR(100)", "NN", "What was done"],
    ["incident_id", "INT", "FK:incidents.incident_id", "Incident affected"],
    ["previous_value", "TEXT", "", "Value before"],
    ["new_value", "TEXT", "", "Value after"],
    ["action_performed", "VARCHAR(20)", "", "Create, Update, Status Change, Login..."],
    ["logged_at", "DATETIME", "NN", "Date and time"]] }
];
const INDEXES = [
  ["incidents", "status"], ["incidents", "incident_date"], ["incidents", "reporter_id"], ["incidents", "location_id"],
  ["investigations", "investigator_id"], ["actions", "responsible_id"], ["actions", "target_date"],
  ["notifications", "user_id"], ["audit_logs", "incident_id"]
];

/* ---- Reference data (also used for the first-time sample data) ---- */
const ROLE_LIST = [
  ["Administrator", "Manage system"], ["Reporter", "Report incidents"], ["Incident Officer", "Manage incident records"],
  ["Investigator", "Investigate incidents"], ["Action Officer", "Implement corrective actions"],
  ["Supervisor", "Review and approve"], ["Management", "View reports and dashboards"]];
const DEPT_LIST = ["IT Department", "Facilities", "Security Office", "Human Resources", "Student Affairs", "Library", "Administration"];
const CATEGORY_TYPES = {
  "Safety": ["Slip/Fall", "Equipment Failure", "Equipment Accident", "Fire"],
  "Security": ["Theft", "Unauthorized Access"],
  "Accident": ["Vehicle Accident"],
  "Property Damage": ["Vandalism", "Equipment Damage"],
  "Workplace": ["Harassment Complaint", "Workplace Conflict"],
  "IT/Technical": ["Data Incident", "System Outage"],
  "Environmental": ["Chemical Spill", "Waste Mismanagement"],
  "Health": ["Physical Injury", "Illness Outbreak"],
  "Other": ["Other Incident"]
};

/* ---- Turns SCHEMA into SQL (used by database.sql and the "Export SQL" button) ---- */
function schemaSql() {
  let sql = "-- Incident Reporting System database (generated from schema.js)\nCREATE DATABASE IF NOT EXISTS incident_reporting_system;\nUSE incident_reporting_system;\n\n";
  SCHEMA.forEach(t => {
    const lines = [], fks = [];
    t.fields.forEach(f => {
      const c = f[2].split(" "); let line = "  " + f[0] + " " + f[1];
      if (c.includes("PK")) line += " AUTO_INCREMENT PRIMARY KEY";
      else { if (c.includes("NN")) line += " NOT NULL"; if (c.includes("UQ")) line += " UNIQUE"; }
      lines.push(line);
      c.filter(x => x.startsWith("FK:")).forEach(x => { const [tb, col] = x.slice(3).split("."); fks.push("  FOREIGN KEY (" + f[0] + ") REFERENCES " + tb + "(" + col + ")"); });
    });
    sql += "-- " + t.note + "\nCREATE TABLE " + t.name + " (\n" + lines.concat(fks).join(",\n") + "\n);\n\n";
  });
  INDEXES.forEach(i => sql += "CREATE INDEX idx_" + i[0] + "_" + i[1] + " ON " + i[0] + "(" + i[1] + ");\n");
  sql += "\n-- Initial reference data\n";
  sql += "INSERT INTO roles (role_name, description) VALUES\n" + ROLE_LIST.map(r => "  ('" + r[0] + "', '" + r[1] + "')").join(",\n") + ";\n";
  sql += "INSERT INTO departments (department_name, status) VALUES\n" + DEPT_LIST.map(d => "  ('" + d + "', 'Active')").join(",\n") + ";\n";
  const cats = Object.keys(CATEGORY_TYPES);
  sql += "INSERT INTO incident_categories (category_name, status) VALUES\n" + cats.map(c => "  ('" + c + "', 'Active')").join(",\n") + ";\n";
  const types = []; cats.forEach((c, i) => CATEGORY_TYPES[c].forEach(t => types.push("  (" + (i + 1) + ", '" + t + "', 'Active')")));
  sql += "INSERT INTO incident_types (category_id, type_name, status) VALUES\n" + types.join(",\n") + ";\n";
  return sql;
}
if (typeof module !== "undefined") module.exports = { schemaSql };
