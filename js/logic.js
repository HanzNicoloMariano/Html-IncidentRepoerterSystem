"use strict";
/* =====================================================================
   logic.js - THE BUSINESS RULES (what the system is allowed to do)
   Every function returns { ok:true/false, msg:"...", data:... }.
   The pages (pages*.js) only call these functions and show the message.
   ===================================================================== */
const DENIED = fail("Access denied: your role is not allowed to do this.");
const SEVERITIES = ["Low", "Medium", "High", "Critical"];
const REPORTER_TYPES = ["Employee", "Student", "Visitor", "Contractor"];
const INC_STATUSES = ["Open", "Under Investigation", "For Action", "Resolved", "Closed"];
const TRANSITIONS = { "Open": ["Under Investigation"], "Under Investigation": ["For Action"], "For Action": ["Resolved"], "Resolved": ["Closed"], "Closed": [] };
const INV_STATUSES = ["Assigned", "In Progress", "Evidence Gathering", "Findings Prepared", "Completed"];
const ACTION_TYPES = ["Corrective Action", "Preventive Action", "Safety Improvement", "Equipment Repair", "Policy Improvement", "Training", "Process Improvement"];
const ACTION_STATUSES = ["Pending", "In Progress", "Completed", "Verified"];
const RESOLUTION_TYPES = ["Corrective Action Implemented", "Preventive Measures Implemented", "Referred to Higher Authority", "Resolved - Other"];
const TARGET_DAYS = { Low: 30, Medium: 14, High: 7, Critical: 3 };   // Lab 43: target days to resolve
const ALLOWED_EXT = ["jpg", "jpeg", "png", "pdf", "doc", "docx", "txt"];
const MAX_FILE = 300 * 1024;                                          // 300 KB (browser storage is small)
const isActive = o => o && o.status === "Active";

/* ============ REPORTERS (Labs 4-6) ============ */
function validateReporter(d, id) {
  if (!d.id_number) return "Error: Employee/Student ID is required.";
  if (!d.full_name) return "Error: Full name is required.";
  if (db.reporters.some(r => r.id_number.toLowerCase() === d.id_number.toLowerCase() && r.reporter_id !== id)) return "Error: This ID number is already registered.";
  if (!d.department_id || !getDept(d.department_id)) return "Error: Please select a department.";
  if (!REPORTER_TYPES.includes(d.reporter_type)) return "Error: Please select a reporter type.";
  if (d.contact_number && (d.contact_number.replace(/\D/g, "").length < 7 || /[^0-9+\-\s()]/.test(d.contact_number))) return "Error: Contact number is not valid.";
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return "Error: Email address is not valid.";
  return null;
}
function addReporter(d, actor) {
  if (!can("reporter_manage", actor)) return DENIED;
  const e = validateReporter(d, null); if (e) return fail(e);
  const r = { reporter_id: nextId("reporter"), id_number: d.id_number, full_name: d.full_name, department_id: Number(d.department_id), position: d.position || "",
    contact_number: d.contact_number || "", email: d.email || "", address: d.address || "", reporter_type: d.reporter_type, status: "Active" };
  db.reporters.push(r); audit(actor, "Registered reporter " + r.full_name, null, "", r.id_number, "Create"); save();
  return ok("Reporter registered successfully.", r);
}
function updateReporter(id, d, actor) {
  if (!can("reporter_manage", actor)) return DENIED;
  const r = getReporter(id); if (!r) return fail("Error: Reporter not found.");
  const e = validateReporter(d, id); if (e) return fail(e);
  Object.assign(r, { id_number: d.id_number, full_name: d.full_name, department_id: Number(d.department_id), position: d.position || "",
    contact_number: d.contact_number || "", email: d.email || "", address: d.address || "", reporter_type: d.reporter_type });
  audit(actor, "Updated reporter " + r.full_name, null, "", "", "Update"); save(); return ok("Reporter updated.", r);
}
function toggleStatus(list, key, id, actor, label) {
  if (!can("reporter_manage", actor) && !can("refdata_manage", actor)) return DENIED;
  const o = find(list, key, id); if (!o) return fail("Error: Record not found.");
  const old = o.status; o.status = old === "Active" ? "Inactive" : "Active";
  audit(actor, label + " " + o.status, null, old, o.status, "Status Change"); save(); return ok(label + " is now " + o.status + ".");
}
function reporterProfile(id) {
  const incs = db.incidents.filter(i => i.reporter_id == id).sort((a, b) => a.incident_date < b.incident_date ? 1 : -1);
  return incs.map(i => { const inv = invOfIncident(i.incident_id), res = resolutionOf(i.incident_id);
    return { inc: i, invStatus: inv ? inv.status : "Not started", resStatus: res ? "Resolved (" + res.resolution_date + ")" : "Not resolved" }; });
}

/* ============ CLASSIFICATION, DEPARTMENTS, LOCATIONS (Labs 7, 11) ============ */
function addCategory(name, actor) {
  if (!can("refdata_manage", actor)) return DENIED;
  if (!name) return fail("Error: Category name is required.");
  if (db.categories.some(c => c.category_name.toLowerCase() === name.toLowerCase())) return fail("Error: Category already exists.");
  db.categories.push({ category_id: nextId("category"), category_name: name, status: "Active" });
  audit(actor, "Added category " + name, null, "", name, "Create"); save(); return ok("Category added.");
}
function addType(categoryId, name, actor) {
  if (!can("refdata_manage", actor)) return DENIED;
  if (!getCategory(categoryId)) return fail("Error: Please select a category.");
  if (!name) return fail("Error: Type name is required.");
  if (db.types.some(t => t.category_id == categoryId && t.type_name.toLowerCase() === name.toLowerCase())) return fail("Error: This type already exists in that category.");
  db.types.push({ type_id: nextId("type"), category_id: Number(categoryId), type_name: name, status: "Active" });
  audit(actor, "Added incident type " + name, null, "", name, "Create"); save(); return ok("Incident type added.");
}
function renameRef(list, key, nameField, id, name, actor) {
  if (!can("refdata_manage", actor)) return DENIED;
  const o = find(list, key, id); if (!o) return fail("Error: Record not found.");
  if (!name) return fail("Error: Name cannot be empty.");
  const old = o[nameField]; o[nameField] = name; audit(actor, "Renamed " + old, null, old, name, "Update"); save(); return ok("Updated.");
}
function addDepartment(name, actor) {
  if (!can("refdata_manage", actor)) return DENIED;
  if (!name) return fail("Error: Department name is required.");
  if (db.departments.some(d => d.department_name.toLowerCase() === name.toLowerCase())) return fail("Error: Department already exists.");
  db.departments.push({ department_id: nextId("department"), department_name: name, status: "Active" }); save(); return ok("Department added.");
}
function validateLocation(d, id) {
  if (!d.building) return "Error: Building is required.";
  if (db.locations.some(l => l.building.toLowerCase() === d.building.toLowerCase() && (l.room || "").toLowerCase() === (d.room || "").toLowerCase() && l.location_id !== id))
    return "Error: This building/room already exists.";
  if (d.department_id && !getDept(d.department_id)) return "Error: Department not found.";
  return null;
}
function addLocation(d, actor) {
  if (!can("refdata_manage", actor)) return DENIED;
  const e = validateLocation(d, null); if (e) return fail(e);
  const l = { location_id: nextId("location"), building: d.building, room: d.room || "", area: d.area || "", department_id: d.department_id ? Number(d.department_id) : null,
    floor: d.floor || "", description: d.description || "", status: "Active" };
  db.locations.push(l); audit(actor, "Added location " + locName(l), null, "", locName(l), "Create"); save(); return ok("Location saved.", l);
}
function updateLocation(id, d, actor) {
  if (!can("refdata_manage", actor)) return DENIED;
  const l = getLocation(id); if (!l) return fail("Error: Location not found.");
  const e = validateLocation(d, id); if (e) return fail(e);
  Object.assign(l, { building: d.building, room: d.room || "", area: d.area || "", department_id: d.department_id ? Number(d.department_id) : null, floor: d.floor || "", description: d.description || "" });
  audit(actor, "Updated location " + locName(l), null, "", "", "Update"); save(); return ok("Location updated.");
}

/* ============ INCIDENTS (Labs 8-10, 12, 47) ============ */
function genIncidentNumber() {
  const year = today().slice(0, 4); let n = db.incidents.length + 1, num;
  do { num = "IN-" + year + "-" + String(n++).padStart(4, "0"); } while (db.incidents.some(i => i.incident_number === num));
  return num;
}
function validateIncident(d, id) {
  const rep = getReporter(d.reporter_id);
  if (!rep) return "Error: Reporter is required.";
  if (!isActive(rep)) return "Error: The selected reporter is inactive.";
  const cat = getCategory(d.category_id); if (!cat) return "Error: Incident category is required.";
  const type = getType(d.type_id); if (!type) return "Error: Incident type is required.";
  if (type.category_id != d.category_id) return "Error: Incident type must belong to the selected category.";
  const loc = getLocation(d.location_id); if (!loc) return "Error: A valid incident location is required.";
  if (!isActive(loc)) return "Error: The selected location is inactive.";
  if (!d.incident_date) return "Error: Date of incident is required.";
  if (!dateValid(d.incident_date)) return "Error: Incident date is invalid.";
  if (d.incident_date > today()) return "Error: Incident date cannot be in the future.";
  if (!d.incident_time) return "Error: Time of incident is required.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.incident_time)) return "Error: Incident time is invalid.";
  if (!d.description || !d.description.trim()) return "Error: Incident description cannot be empty.";
  if (!SEVERITIES.includes(d.severity)) return "Error: Please select a severity.";
  if (d.incident_number && db.incidents.some(i => i.incident_number === d.incident_number && i.incident_id !== id)) return "Error: Duplicate incident number.";
  return null;
}
function createIncident(d, actor) {
  if (!can("incident_create", actor)) return DENIED;
  if (roleName(actor) === R.REP) {                         // a Reporter can only report as himself/herself
    if (!actor.reporter_id) return fail("Error: Your account is not linked to a reporter record. Ask the administrator.");
    d = Object.assign({}, d, { reporter_id: actor.reporter_id });
  }
  const e = validateIncident(d, null); if (e) return fail(e);
  const inc = { incident_id: nextId("incident"), incident_number: d.incident_number || genIncidentNumber(), reporter_id: Number(d.reporter_id),
    category_id: Number(d.category_id), type_id: Number(d.type_id), location_id: Number(d.location_id), incident_date: d.incident_date,
    incident_time: d.incident_time, description: d.description.trim(), severity: d.severity, immediate_response: d.immediate_response || "",
    status: "Open", date_reported: today(), closure_date: "", closed_by: null };
  db.incidents.push(inc);
  audit(actor, "Reported incident " + inc.incident_number, inc.incident_id, "", "Open", "Create");
  usersWithRole(R.IO).forEach(u => notify(u.user_id, "New incident reported: " + inc.incident_number + " (" + inc.severity + ")", inc.incident_id));
  save(); return ok("Incident " + inc.incident_number + " saved successfully.", inc);
}
function updateIncident(id, d, actor) {
  const inc = getIncident(id); if (!inc) return fail("Error: Incident not found.");
  if (inc.status === "Closed" && !can("incident_edit_closed", actor)) return fail("Error: Closed incidents cannot be edited.");
  if (!can("incident_edit", actor) && !can("incident_edit_closed", actor)) return DENIED;
  const data = Object.assign({}, inc, d, { incident_number: inc.incident_number });
  const e = validateIncident(data, id); if (e) return fail(e);
  ["category_id", "type_id", "location_id", "incident_date", "incident_time", "description", "severity", "immediate_response"].forEach(k => {
    if (String(inc[k]) !== String(data[k])) { audit(actor, "Edited incident field " + k, id, inc[k], data[k], "Update"); inc[k] = ["category_id", "type_id", "location_id"].includes(k) ? Number(data[k]) : data[k]; }
  });
  save(); return ok("Incident updated.", inc);
}
function setStatus(inc, to, actor) {                        // internal: used by the workflow
  if (!(TRANSITIONS[inc.status] || []).includes(to)) throw new Error("Invalid status transition: " + inc.status + " to " + to);
  const old = inc.status; inc.status = to; audit(actor, "Status changed", inc.incident_id, old, to, "Status Change");
}
function changeIncidentStatus(id, to, actor) {              // manual change (Lab 47/48 rules)
  if (!can("status_change", actor)) return fail("Error: Only authorized personnel can change incident status.");
  const inc = getIncident(id); if (!inc) return fail("Error: Incident not found.");
  if (!INC_STATUSES.includes(to)) return fail("Error: Unknown status.");
  if (!(TRANSITIONS[inc.status] || []).includes(to)) return fail("Invalid status transition: cannot change from " + inc.status + " to " + to + ".");
  if (to === "Under Investigation" && !invOfIncident(id)) return fail("Error: Assign an investigator first (Investigations page).");
  if (to === "For Action") { const inv = invOfIncident(id); if (!inv || inv.status !== "Completed") return fail("Error: The investigation must be completed first."); }
  if (to === "Resolved" && !resolutionOf(id)) return fail("Error: Record the resolution first.");
  if (to === "Closed") return fail("Error: Use the Closure process (Resolutions page).");
  setStatus(inc, to, actor); save(); return ok("Status changed to " + to + ".");
}
function validateFile(f) {
  if (!f || !f.name) return "Error: Please choose a file.";
  const ext = f.name.split(".").pop().toLowerCase();
  if (f.name.split(".").length < 2 || !ALLOWED_EXT.includes(ext) || /[\\/<>:"|?*]/.test(f.name)) return "Invalid file: only JPG, PNG, PDF, DOC, DOCX or TXT files are allowed.";
  if (f.size > MAX_FILE) return "Invalid file: the file is larger than " + (MAX_FILE / 1024) + " KB.";
  if (f.size <= 0) return "Invalid file: the file is empty.";
  return null;
}
function addAttachment(incId, f, actor) {
  const inc = getIncident(incId); if (!inc) return fail("Error: Incident not found.");
  if (!can("incident_create", actor) && !can("incident_edit", actor)) return DENIED;
  const e = validateFile(f); if (e) return fail(e);
  db.attachments.push({ attachment_id: nextId("attachment"), incident_id: inc.incident_id, file_name: f.name, file_type: f.name.split(".").pop().toLowerCase(),
    file_size: f.size, uploaded_by: actor.user_id, uploaded_at: today(), data: f.data || "" });
  audit(actor, "Attached file " + f.name, incId, "", f.name, "Create"); save(); return ok("File attached.");
}

/* ============ INVESTIGATIONS (Labs 14-19) ============ */
function assignInvestigation(d, actor) {
  if (!can("investigation_assign", actor)) return DENIED;
  const inc = getIncident(d.incident_id); if (!inc) return fail("Error: Please select an incident.");
  if (inc.status !== "Open") return fail("Error: Only newly reported (Open) incidents can be assigned for investigation.");
  if (invOfIncident(inc.incident_id)) return fail("Error: This incident already has an investigation.");
  const inv = getUser(d.investigator_id);
  if (!inv || inv.status !== "Active" || roleName(inv) !== R.INV) return fail("Error: Please select an active investigator.");
  if (!d.start_date || !dateValid(d.start_date)) return fail("Error: Investigation start date is required and must be valid.");
  if (!d.target_date || !dateValid(d.target_date)) return fail("Error: Target completion date is required and must be valid.");
  if (d.target_date < d.start_date) return fail("Error: Investigation deadline cannot precede the start date.");
  if (d.start_date < inc.incident_date) return fail("Error: Investigation cannot start before the incident date.");
  const rec = { investigation_id: nextId("investigation"), incident_id: inc.incident_id, investigator_id: inv.user_id, assigned_by: actor.user_id,
    assigned_date: today(), start_date: d.start_date, target_date: d.target_date, completion_date: "", status: "Assigned",
    instructions: d.instructions || "", notes: "" };
  db.investigations.push(rec); setStatus(inc, "Under Investigation", actor);
  audit(actor, "Assigned investigation to " + inv.full_name, inc.incident_id, "", inv.full_name, "Create");
  notify(inv.user_id, "You were assigned to investigate " + inc.incident_number + ". Deadline: " + rec.target_date, inc.incident_id);
  save(); return ok("Investigation assigned to " + inv.full_name + ". Incident status is now Under Investigation.", rec);
}
const canWorkOn = (inv, actor) => !!actor && (roleName(actor) === R.ADMIN || (roleName(actor) === R.INV && inv.investigator_id === actor.user_id));
function saveNotes(invId, notes, actor) {
  const inv = getInvestigation(invId); if (!inv) return fail("Error: Investigation not found.");
  if (!canWorkOn(inv, actor)) return DENIED;
  inv.notes = notes; audit(actor, "Updated investigation notes", inv.incident_id, "", "", "Update"); save(); return ok("Notes saved.");
}
function saveFindings(invId, d, actor) {
  const inv = getInvestigation(invId); if (!inv) return fail("Error: Investigation not found.");
  if (!canWorkOn(inv, actor)) return DENIED;
  if (inv.status === "Completed") return fail("Error: A completed investigation cannot be edited.");
  if ("findings" in d && !d.findings) return fail("Error: Findings cannot be empty.");
  if ("root_cause" in d && !d.root_cause) return fail("Error: Root cause is required.");
  if ("rca_problem" in d && (!d.rca_problem || !d.rca_cause)) return fail("Error: Problem and cause are required for the root cause analysis.");
  let f = findingsOf(invId);
  if (!f) { f = { finding_id: nextId("finding"), investigation_id: Number(invId), findings: "", witnesses: "", recommendation: "", rca_problem: "", rca_cause: "",
    rca_evidence: "", immediate_cause: "", root_cause: "", contributing_factors: "", preventive_measures: "" }; db.findings.push(f); }
  Object.keys(d).forEach(k => { if (k in f && k !== "finding_id" && k !== "investigation_id") f[k] = d[k]; });
  audit(actor, "Recorded investigation findings", inv.incident_id, "", "", "Update"); save(); return ok("Findings saved.", f);
}
function validateEvidenceAccess(inv, actor) { return can("evidence_view", actor) && (roleName(actor) !== R.INV || inv.investigator_id === actor.user_id); }
function addEvidence(invId, f, description, actor) {
  const inv = getInvestigation(invId); if (!inv) return fail("Error: Investigation not found.");
  if (!canWorkOn(inv, actor)) return DENIED;
  if (inv.status === "Completed") return fail("Error: Evidence cannot be added to a completed investigation.");
  const e = validateFile(f); if (e) return fail(e);
  db.evidence.push({ evidence_id: nextId("evidence"), investigation_id: inv.investigation_id, file_name: f.name, file_type: f.name.split(".").pop().toLowerCase(),
    file_size: f.size, description: description || "", uploaded_by: actor.user_id, uploaded_at: today(), data: f.data || "" });
  audit(actor, "Uploaded evidence " + f.name, inv.incident_id, "", f.name, "Create"); save(); return ok("Evidence uploaded and linked to the investigation.");
}
function updateInvestigationStatus(invId, to, actor) {
  const inv = getInvestigation(invId); if (!inv) return fail("Error: Investigation not found.");
  if (!canWorkOn(inv, actor)) return DENIED;
  const cur = INV_STATUSES.indexOf(inv.status), nxt = INV_STATUSES.indexOf(to);
  if (nxt !== cur + 1) return fail("Invalid status transition: " + inv.status + " can only move to " + (INV_STATUSES[cur + 1] || "nothing (already completed)") + ".");
  const f = findingsOf(invId);
  if (to === "Findings Prepared" && !(f && f.findings)) return fail("Error: Record the findings before moving to Findings Prepared.");
  if (to === "Completed" && !(f && f.findings && f.root_cause)) return fail("Error: Findings and root cause must be completed before the investigation can be completed.");
  const old = inv.status; inv.status = to;
  const inc = getIncident(inv.incident_id);
  if (to === "Completed") {
    inv.completion_date = today(); setStatus(inc, "For Action", actor);
    usersWithRole(R.IO).concat(usersWithRole(R.SUP)).forEach(u => notify(u.user_id, "Investigation completed for " + inc.incident_number + ". Corrective actions can now be assigned.", inc.incident_id));
  }
  audit(actor, "Investigation status changed", inv.incident_id, old, to, "Status Change"); save();
  return ok("Investigation status: " + to + (to === "Completed" ? ". Incident status is now For Action." : "."));
}
const invOverdue = inv => inv.status !== "Completed" && inv.target_date < today();

/* ============ ACTIONS (Labs 20-23) ============ */
function createAction(d, actor) {
  if (!can("action_create", actor)) return DENIED;
  const inc = getIncident(d.incident_id); if (!inc) return fail("Error: Please select an incident.");
  const inv = invOfIncident(inc.incident_id);
  if (!inv) return fail("Error: This incident has no investigation yet.");
  if (roleName(actor) === R.INV && inv.investigator_id !== actor.user_id) return DENIED;
  const f = findingsOf(inv.investigation_id);
  if (!(f && f.findings && f.root_cause)) return fail("Error: Actions must be based on investigation findings. Record the findings and root cause first.");
  if (["Resolved", "Closed"].includes(inc.status)) return fail("Error: Actions cannot be added to a " + inc.status.toLowerCase() + " incident.");
  if (!ACTION_TYPES.includes(d.action_type)) return fail("Error: Please select an action type.");
  if (!d.description || !d.description.trim()) return fail("Error: Action description is required.");
  const person = getUser(d.responsible_id);
  if (!person || person.status !== "Active" || roleName(person) !== R.AO) return fail("Error: Please select an active Action Officer as the responsible person.");
  if (!d.target_date || !dateValid(d.target_date)) return fail("Error: Target date is required and must be valid.");
  if (d.target_date < inc.incident_date) return fail("Error: Target date cannot precede the incident date.");
  if (!SEVERITIES.includes(d.priority)) return fail("Error: Please select a priority.");
  const a = { action_id: nextId("action"), incident_id: inc.incident_id, investigation_id: inv.investigation_id, action_type: d.action_type, description: d.description.trim(),
    responsible_id: person.user_id, target_date: d.target_date, priority: d.priority, status: "Pending", completion_date: "", is_required: d.is_required !== false, remarks: "" };
  db.actions.push(a);
  db.monitoring.push({ monitor_id: nextId("monitor"), action_id: a.action_id, old_status: "", new_status: "Pending", remarks: "Action created", changed_by: actor.user_id, changed_at: today() });
  audit(actor, "Created action: " + a.action_type, inc.incident_id, "", a.description, "Create");
  notify(person.user_id, "New action assigned for " + inc.incident_number + ": " + a.action_type + " (due " + a.target_date + ")", inc.incident_id);
  save(); return ok("Action saved and assigned to " + person.full_name + ".", a);
}
function updateActionStatus(actionId, to, remarks, actor) {
  const a = getAction(actionId); if (!a) return fail("Error: Action not found.");
  const mine = actor && a.responsible_id === actor.user_id;
  if (!(mine || can("action_verify", actor))) return DENIED;
  const cur = ACTION_STATUSES.indexOf(a.status), nxt = ACTION_STATUSES.indexOf(to);
  if (nxt !== cur + 1) return fail("Invalid status transition: " + a.status + " can only move to " + (ACTION_STATUSES[cur + 1] || "nothing (already verified)") + ".");
  if (to === "Verified" && !can("action_verify", actor)) return fail("Error: Only a supervisor or incident officer can verify an action.");
  if (to === "Completed" && !remarks) return fail("Error: Please enter remarks describing what was done.");
  const old = a.status; a.status = to; if (remarks) a.remarks = remarks;
  if (to === "Completed") a.completion_date = today();
  db.monitoring.push({ monitor_id: nextId("monitor"), action_id: a.action_id, old_status: old, new_status: to, remarks: remarks || "", changed_by: actor.user_id, changed_at: today() });
  audit(actor, "Action status changed", a.incident_id, old, to, "Status Change");
  if (to === "Completed") usersWithRole(R.SUP).concat(usersWithRole(R.IO)).forEach(u => notify(u.user_id, "Action completed for " + getIncident(a.incident_id).incident_number + ". Please verify.", a.incident_id));
  save(); return ok("Action status: " + to + ".");
}
const isDone = a => a.status === "Completed" || a.status === "Verified";
function overdueActions() {                       // Current Date > Target Date AND status is not Completed
  return db.actions.filter(a => !isDone(a) && a.target_date < today())
    .map(a => ({ a, days: daysBetween(a.target_date, today()) })).sort((x, y) => y.days - x.days);
}

/* ============ RESOLUTION & CLOSURE (Labs 24-26) ============ */
function checkResolutionRules(incId) {            // returns a list of problems (empty = ready)
  const inc = getIncident(incId), problems = [];
  if (!inc) return ["Incident not found."];
  const inv = invOfIncident(incId);
  if (!inv) problems.push("Incident must have an investigation.");
  else if (inv.status !== "Completed") problems.push("Investigation must be completed (now: " + inv.status + ").");
  const acts = actionsOfIncident(incId);
  if (!acts.length) problems.push("No corrective action has been recorded.");
  acts.filter(a => a.is_required && !isDone(a)).forEach(a => problems.push("Required action not completed: " + a.action_type + " (" + a.status + ")."));
  return problems;
}
function recordResolution(d, actor) {
  if (!can("resolution_record", actor)) return fail("Error: Only authorized personnel can record the final resolution.");
  const inc = getIncident(d.incident_id); if (!inc) return fail("Error: Please select an incident.");
  if (resolutionOf(inc.incident_id)) return fail("Error: This incident already has a resolution.");
  const problems = checkResolutionRules(inc.incident_id);
  if (problems.length) return fail("Cannot resolve yet: " + problems.join(" "));
  if (inc.status !== "For Action") return fail("Invalid status transition: cannot resolve an incident that is " + inc.status + ".");
  if (!RESOLUTION_TYPES.includes(d.resolution_type)) return fail("Error: Please select a resolution type.");
  if (!d.description || !d.description.trim()) return fail("Error: Resolution description is required.");
  if (!d.resolution_date || !dateValid(d.resolution_date)) return fail("Error: Resolution date is required and must be valid.");
  if (d.resolution_date < inc.incident_date) return fail("Error: Resolution date cannot precede the incident date.");
  if (d.resolution_date > today()) return fail("Error: Resolution date cannot be in the future.");
  const r = { resolution_id: nextId("resolution"), incident_id: inc.incident_id, resolution_type: d.resolution_type, description: d.description.trim(),
    resolution_date: d.resolution_date, resolved_by: actor.user_id, remarks: d.remarks || "", supporting_document: d.supporting_document || "" };
  db.resolutions.push(r); setStatus(inc, "Resolved", actor);
  audit(actor, "Recorded resolution", inc.incident_id, "", r.resolution_type, "Create");
  usersWithRole(R.SUP).forEach(u => notify(u.user_id, inc.incident_number + " is resolved and ready for closure review.", inc.incident_id));
  const rep = getReporter(inc.reporter_id); db.users.filter(u => u.reporter_id === inc.reporter_id).forEach(u => notify(u.user_id, "Your incident " + inc.incident_number + " has been resolved.", inc.incident_id));
  save(); return ok("Resolution recorded. Incident status is now Resolved.", r);
}
function closeIncident(incId, confirmed, remarks, actor) {
  if (!can("incident_close", actor)) return fail("Error: Only authorized users (Supervisor or Administrator) can close an incident.");
  const inc = getIncident(incId); if (!inc) return fail("Error: Incident not found.");
  if (inc.status !== "Resolved") return fail("Invalid status transition: only a Resolved incident can be closed (now: " + inc.status + ").");
  const res = resolutionOf(incId); if (!res) return fail("Error: The incident has no resolution.");
  if (!confirmed) return fail("Error: Please confirm that you reviewed the incident, findings, actions and resolution.");
  if (actionsOfIncident(incId).some(a => a.is_required && !isDone(a))) return fail("Error: Required corrective actions must be completed before closure.");
  if (today() < res.resolution_date) return fail("Error: Closure date cannot precede the resolution date.");
  setStatus(inc, "Closed", actor); inc.closure_date = today(); inc.closed_by = actor.user_id;
  audit(actor, "Closed incident. " + (remarks || ""), incId, "Resolved", "Closed", "Status Change");
  db.users.filter(u => u.reporter_id === inc.reporter_id).forEach(u => notify(u.user_id, "Your incident " + inc.incident_number + " is now closed.", incId));
  save(); return ok("Incident " + inc.incident_number + " is now Closed.");
}

/* ============ INTEGRATION CHECKS (Labs 27-32) & TRACE (Lab 33) ============ */
function check(name, rule, items, test) {         // runs test(item) on every record; test returns an error text or ""
  const problems = []; items.forEach(i => { const p = test(i); if (p) problems.push(p); });
  return { name, rule, checked: items.length, problems };
}
const INTEGRATION_CHECKS = {
  27: () => check("Reporter → Incident", "Every incident is stored with a valid reporter", db.incidents, i => getReporter(i.reporter_id) ? "" : i.incident_number + ": reporter missing"),
  28: () => check("Incident → Location", "Every incident has a valid location", db.incidents, i => getLocation(i.location_id) ? "" : i.incident_number + ": location missing"),
  29: () => check("Incident → Investigator → Investigation", "An incident is investigated only after being reported; the investigator is a valid Investigator", db.investigations, v => {
    const inc = getIncident(v.incident_id), u = getUser(v.investigator_id);
    if (!inc) return "Investigation " + v.investigation_id + ": incident missing";
    if (!u || roleName(u) !== R.INV) return inc.incident_number + ": investigator is not a valid Investigator";
    if (v.start_date < inc.incident_date) return inc.incident_number + ": investigation starts before the incident";
    return ""; }),
  30: () => check("Findings → Root Cause → Action", "Every action belongs to an investigation of the same incident, and that investigation has findings and a root cause", db.actions, a => {
    const inv = getInvestigation(a.investigation_id), f = inv && findingsOf(inv.investigation_id);
    if (!inv || inv.incident_id !== a.incident_id) return "Action " + a.action_id + ": investigation does not match the incident";
    if (!(f && f.findings && f.root_cause)) return "Action " + a.action_id + ": no findings/root cause behind it";
    return ""; }),
  31: () => check("Action → Completion → Resolution", "Every resolved/closed incident has all required actions completed", db.resolutions, r => {
    const open = actionsOfIncident(r.incident_id).filter(a => a.is_required && !isDone(a));
    return open.length ? getIncident(r.incident_id).incident_number + ": " + open.length + " required action(s) not completed" : ""; }),
  32: () => check("Resolution → Confirmation → Closed", "Every closed incident has a resolution, a closure date and was closed by an authorized user", db.incidents.filter(i => i.status === "Closed"), i => {
    const res = resolutionOf(i.incident_id), u = getUser(i.closed_by);
    if (!res) return i.incident_number + ": closed without resolution";
    if (!i.closure_date || i.closure_date < res.resolution_date) return i.incident_number + ": closure date problem";
    if (!u || !can("incident_close", u)) return i.incident_number + ": closed by an unauthorized user";
    return ""; })
};
const TABLE_TO_LIST = { roles: "roles", departments: "departments", reporters: "reporters", users: "users", incident_categories: "categories", incident_types: "types", locations: "locations",
  incidents: "incidents", incident_attachments: "attachments", investigations: "investigations", investigation_findings: "findings", investigation_evidence: "evidence",
  actions: "actions", action_monitoring: "monitoring", resolutions: "resolutions", notifications: "notifications", audit_logs: "audit" };
function checkRelationships() {                    // Lab 3: test that every foreign key points to a real record
  const problems = []; let checked = 0;
  SCHEMA.forEach(t => {
    t.fields.forEach(f => f[2].split(" ").filter(c => c.startsWith("FK:")).forEach(c => {
      const [tb, col] = c.slice(3).split("."); const target = db[TABLE_TO_LIST[tb]];
      db[TABLE_TO_LIST[t.name]].forEach(rec => { const v = rec[f[0]]; if (v === null || v === undefined || v === "") return; checked++;
        if (!target.some(x => x[col] == v)) problems.push(t.name + "." + f[0] + " = " + v + " has no matching " + tb + "." + col); });
    }));
  });
  return { name: "Foreign key relationships", rule: "Every foreign key value points to an existing record", checked, problems };
}
function traceIncident(id) {                       // Lab 33: one complete, traceable record
  const inc = getIncident(id); if (!inc) return [];
  const rep = getReporter(inc.reporter_id), inv = invOfIncident(id), f = inv && findingsOf(inv.investigation_id), acts = actionsOfIncident(id), res = resolutionOf(id);
  const iu = inv && getUser(inv.investigator_id);
  return [
    { step: "Reporter", done: !!rep, text: rep ? rep.full_name + " (" + rep.id_number + ")" : "-" },
    { step: "Incident", done: true, text: inc.incident_number + " - " + (getType(inc.type_id) || {}).type_name + " (" + inc.severity + "), reported " + inc.date_reported },
    { step: "Location", done: !!getLocation(inc.location_id), text: locName(getLocation(inc.location_id)) },
    { step: "Investigation Assignment", done: !!inv, text: inv ? "Assigned to " + iu.full_name + " on " + inv.assigned_date + ", deadline " + inv.target_date : "Not assigned yet" },
    { step: "Investigation", done: !!inv && inv.status === "Completed", text: inv ? "Status: " + inv.status + (inv.completion_date ? " (completed " + inv.completion_date + ")" : "") : "-" },
    { step: "Findings / Root Cause", done: !!(f && f.root_cause), text: f && f.root_cause ? "Root cause: " + f.root_cause : "Not recorded" },
    { step: "Corrective Action", done: acts.length > 0 && acts.every(isDone), text: acts.length ? acts.map(a => a.action_type + " - " + a.status).join("; ") : "No actions" },
    { step: "Resolution", done: !!res, text: res ? res.resolution_type + " on " + res.resolution_date : "Not resolved" },
    { step: "Closure", done: inc.status === "Closed", text: inc.status === "Closed" ? "Closed on " + inc.closure_date + " by " + (getUser(inc.closed_by) || {}).full_name : "Not closed" }
  ];
}

/* ============ REPORTS (Labs 38-44) ============ */
const inRange = (date, f) => (!f.from || date >= f.from) && (!f.to || date <= f.to);
function countBy(list, keyFn) { const m = {}; list.forEach(x => { const k = keyFn(x); m[k] = (m[k] || 0) + 1; }); return m; }
const rowsOf = (m, extra) => Object.keys(m).sort((a, b) => m[b] - m[a]).map(k => [k, m[k]].concat(extra ? extra(k) : []));
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + "%" : "0%";
function buildReport(type, f) {
  f = f || {};
  const incs = db.incidents.filter(i => inRange(i.incident_date, f));
  const ids = new Set(incs.map(i => i.incident_id));
  const sections = []; let title = "";
  const sec = (name, headers, rows) => sections.push({ name, headers, rows });
  if (type === "summary") {
    title = "Incident Summary Report";
    const c = countBy(incs, i => i.status);
    sec("Incident counts", ["Measure", "Count", "Share"], [["Total incidents", incs.length, "100%"]].concat(
      [["Open incidents", "Open"], ["Under investigation", "Under Investigation"], ["For action", "For Action"], ["Resolved incidents", "Resolved"], ["Closed incidents", "Closed"]]
        .map(x => [x[0], c[x[1]] || 0, pct(c[x[1]] || 0, incs.length)])));
  } else if (type === "category") {
    title = "Incident Category Report";
    sec("By incident category", ["Category", "Incidents"], rowsOf(countBy(incs, i => (getCategory(i.category_id) || {}).category_name)));
    sec("By incident type", ["Type", "Incidents"], rowsOf(countBy(incs, i => (getType(i.type_id) || {}).type_name)));
    sec("By severity", ["Severity", "Incidents"], SEVERITIES.map(s => [s, incs.filter(i => i.severity === s).length]));
    sec("By department (of the location)", ["Department", "Incidents"], rowsOf(countBy(incs, i => nameOf(getDept((getLocation(i.location_id) || {}).department_id), "department_name") || "-")));
    sec("By location", ["Location", "Incidents"], rowsOf(countBy(incs, i => locName(getLocation(i.location_id)))));
  } else if (type === "location") {
    title = "Incident Location Report";
    sec("Incidents by building", ["Building", "Incidents"], rowsOf(countBy(incs, i => (getLocation(i.location_id) || {}).building)));
    sec("Incidents by room", ["Room / Location", "Incidents"], rowsOf(countBy(incs, i => locName(getLocation(i.location_id)))));
    sec("Incidents by department", ["Department", "Incidents"], rowsOf(countBy(incs, i => nameOf(getDept((getLocation(i.location_id) || {}).department_id), "department_name") || "-")));
    const w = { Low: 1, Medium: 2, High: 3, Critical: 4 }, score = {};
    incs.forEach(i => { const k = locName(getLocation(i.location_id)); score[k] = (score[k] || 0) + w[i.severity]; });
    const high = countBy(incs.filter(i => ["High", "Critical"].includes(i.severity)), i => locName(getLocation(i.location_id)));
    sec("High-risk locations (risk score: Low=1, Medium=2, High=3, Critical=4)", ["Location", "High/Critical incidents", "Risk score"],
      Object.keys(high).sort((a, b) => score[b] - score[a]).map(k => [k, high[k], score[k]]));
    const cl = countBy(incs, i => locName(getLocation(i.location_id)));
    sec("Recurring incident locations (2 or more incidents)", ["Location", "Incidents", "Most common type"],
      Object.keys(cl).filter(k => cl[k] >= 2).sort((a, b) => cl[b] - cl[a]).map(k => { const tm = countBy(incs.filter(i => locName(getLocation(i.location_id)) === k), i => (getType(i.type_id) || {}).type_name);
        return [k, cl[k], Object.keys(tm).sort((a, b) => tm[b] - tm[a])[0]]; }));
  } else if (type === "investigation") {
    title = "Investigation Report";
    const invs = db.investigations.filter(v => ids.has(v.incident_id)), done = invs.filter(v => v.status === "Completed");
    const avg = done.length ? (done.reduce((a, v) => a + daysBetween(v.start_date, v.completion_date), 0) / done.length).toFixed(1) + " days" : "n/a";
    sec("Investigation summary", ["Measure", "Value"], [["Assigned investigations", invs.length], ["Completed investigations", done.length], ["Pending investigations", invs.length - done.length],
      ["Overdue investigations", invs.filter(invOverdue).length], ["Average investigation duration", avg]]);
    sec("Investigation list", ["Incident", "Investigator", "Start", "Deadline", "Status", "Overdue?"], invs.map(v => [getIncident(v.incident_id).incident_number, getUser(v.investigator_id).full_name, v.start_date, v.target_date, v.status, invOverdue(v) ? "YES" : "No"]));
  } else if (type === "action") {
    title = "Corrective Action Report";
    const acts = db.actions.filter(a => ids.has(a.incident_id));
    sec("Action summary", ["Measure", "Count"], [["Total actions", acts.length], ["Pending actions", acts.filter(a => a.status === "Pending").length], ["In progress", acts.filter(a => a.status === "In Progress").length],
      ["Completed actions (incl. verified)", acts.filter(isDone).length], ["Overdue actions", acts.filter(a => !isDone(a) && a.target_date < today()).length]]);
    const per = {}; acts.forEach(a => { const n = getUser(a.responsible_id).full_name; per[n] = per[n] || [0, 0, 0]; per[n][0]++; if (isDone(a)) per[n][1]++; else if (a.target_date < today()) per[n][2]++; });
    sec("Actions by responsible person", ["Person", "Total", "Completed", "Overdue"], Object.keys(per).map(k => [k].concat(per[k])));
  } else if (type === "resolution") {
    title = "Incident Resolution Report";
    const resd = incs.filter(i => resolutionOf(i.incident_id));
    const days = resd.map(i => daysBetween(i.date_reported, resolutionOf(i.incident_id).resolution_date));
    const within = resd.filter(i => daysBetween(i.date_reported, resolutionOf(i.incident_id).resolution_date) <= TARGET_DAYS[i.severity]).length;
    const overdueRes = incs.filter(i => !resolutionOf(i.incident_id) && daysBetween(i.date_reported, today()) > TARGET_DAYS[i.severity]);
    sec("Resolution summary", ["Measure", "Value"], [["Total resolved incidents", resd.length], ["Resolution rate", pct(resd.length, incs.length)],
      ["Average resolution time", days.length ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1) + " days" : "n/a"], ["Incidents resolved within target", within + " of " + resd.length],
      ["Overdue resolutions (unresolved past target)", overdueRes.length], ["Targets (days)", "Critical 3, High 7, Medium 14, Low 30"]]);
    sec("Overdue resolutions", ["Incident", "Severity", "Reported", "Days open", "Target days"], overdueRes.map(i => [i.incident_number, i.severity, i.date_reported, daysBetween(i.date_reported, today()), TARGET_DAYS[i.severity]]));
  } else if (type === "trend") {
    title = "Incident Trend Analysis";
    const months = [...new Set(incs.map(i => monthOf(i.incident_date)))].sort();
    sec("Monthly incidents", ["Month", "Incidents"].concat(SEVERITIES), months.map(m => { const l = incs.filter(i => monthOf(i.incident_date) === m); return [m, l.length].concat(SEVERITIES.map(s => l.filter(i => i.severity === s).length)); }));
    const q = i => i.incident_date.slice(0, 4) + "-Q" + (Math.floor((Number(i.incident_date.slice(5, 7)) - 1) / 3) + 1);
    sec("Quarterly incidents", ["Quarter", "Incidents"], rowsOf(countBy(incs, q)).sort((a, b) => a[0] < b[0] ? -1 : 1));
    const cats = [...new Set(incs.map(i => (getCategory(i.category_id) || {}).category_name))];
    sec("Incident categories per month", ["Month"].concat(cats), months.map(m => [m].concat(cats.map(c => incs.filter(i => monthOf(i.incident_date) === m && (getCategory(i.category_id) || {}).category_name === c).length))));
    const types = [...new Set(incs.map(i => (getType(i.type_id) || {}).type_name))];
    sec("Incident types (total)", ["Type", "Incidents"], rowsOf(countBy(incs, i => (getType(i.type_id) || {}).type_name)));
    sec("Locations (total)", ["Location", "Incidents"], rowsOf(countBy(incs, i => locName(getLocation(i.location_id)))));
    sec("Resolution rate by month reported", ["Month", "Reported", "Resolved/Closed", "Rate"], months.map(m => { const l = incs.filter(i => monthOf(i.incident_date) === m), r = l.filter(i => resolutionOf(i.incident_id)).length; return [m, l.length, r, pct(r, l.length)]; }));
  }
  return { title, sections };
}
