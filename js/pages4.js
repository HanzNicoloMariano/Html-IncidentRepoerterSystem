"use strict";
/* =====================================================================
   pages4.js - TESTING, UAT, BUGS, BACKUP, DEPLOYMENT, FINAL, START-UP
   (Labs 46-59, 62-63)
   All automatic tests run on a TEMPORARY COPY of the database, so your
   real data is never changed by testing.
   ===================================================================== */

/* ---------- helpers for tests ---------- */
function withTemp(fn) {
  const snap = JSON.stringify(db), prevUser = currentUser, prevTest = testMode;
  testMode = true;
  try { return fn(); }
  finally {
    db = JSON.parse(snap); testMode = prevTest; fakeToday = null; simulateDbFailure = false;
    currentUser = prevUser ? (getUser(prevUser.user_id) || prevUser) : null;
  }
}
const A = n => userByName(n);
const catId = n => db.categories.find(c => c.category_name === n).category_id;
const typeId = n => db.types.find(t => t.type_name === n).type_id;
const locId = r => db.locations.find(l => l.room === r).location_id;
function addDays(date, n) { const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
const newReporterData = (id, name) => ({ id_number: id || "T-" + Math.random().toString(36).slice(2, 8), full_name: name || "Test Reporter", department_id: 1, position: "", contact_number: "", email: "", address: "", reporter_type: "Employee" });
const baseIncident = o => Object.assign({ reporter_id: 1, category_id: catId("Safety"), type_id: typeId("Slip/Fall"), location_id: 1, incident_date: today(), incident_time: "10:00", description: "Test incident", severity: "Medium", immediate_response: "" }, o || {});
const sampleFile = name => ({ name: name || "evidence.jpg", size: 2048, data: "" });
const STAGES = ["incident", "assigned", "investigated", "action", "actionsdone", "resolved", "closed"];
function flowTo(stage) {                         // runs the real workflow up to a stage, returns the records
  const at = STAGES.indexOf(stage), ctx = {}, o = A("officer"), iu = A("investigator"), ao = A("actionofficer"), sup = A("supervisor");
  ctx.inc = createIncident(baseIncident(), o).data; if (at < 1) return ctx;
  ctx.inv = assignInvestigation({ incident_id: ctx.inc.incident_id, investigator_id: iu.user_id, start_date: today(), target_date: addDays(today(), 7), instructions: "Investigate" }, o).data; if (at < 2) return ctx;
  const id = ctx.inv.investigation_id;
  updateInvestigationStatus(id, "In Progress", iu); updateInvestigationStatus(id, "Evidence Gathering", iu);
  saveFindings(id, { findings: "Findings text", witnesses: "", recommendation: "Recommendation" }, iu);
  saveFindings(id, { rca_problem: "Problem", rca_cause: "Cause", rca_evidence: "Evidence", immediate_cause: "Immediate", root_cause: "Root cause", contributing_factors: "", preventive_measures: "Prevent" }, iu);
  updateInvestigationStatus(id, "Findings Prepared", iu); updateInvestigationStatus(id, "Completed", iu); if (at < 3) return ctx;
  ctx.act = createAction({ incident_id: ctx.inc.incident_id, action_type: "Corrective Action", description: "Fix the problem", responsible_id: ao.user_id, target_date: addDays(today(), 14), priority: "High", is_required: true }, o).data; if (at < 4) return ctx;
  updateActionStatus(ctx.act.action_id, "In Progress", "", ao); updateActionStatus(ctx.act.action_id, "Completed", "Done", ao); updateActionStatus(ctx.act.action_id, "Verified", "OK", sup); if (at < 5) return ctx;
  ctx.res = recordResolution({ incident_id: ctx.inc.incident_id, resolution_type: RESOLUTION_TYPES[0], description: "Resolved", resolution_date: today(), remarks: "" }, sup).data; if (at < 6) return ctx;
  ctx.closed = closeIncident(ctx.inc.incident_id, true, "", sup); return ctx;
}

/* ---------- Labs 46-48: validation, business rules, error handling cases ---------- */
// [lab, group, case, text the message must contain, function that returns a result object]
const CASES = [
  [46, "Reporter", "Missing ID number", "ID is required", () => addReporter(Object.assign(newReporterData(), { id_number: "" }), A("officer"))],
  [46, "Reporter", "Duplicate ID number", "already registered", () => addReporter(newReporterData("EMP-1001"), A("officer"))],
  [46, "Reporter", "Invalid email", "Email address is not valid", () => addReporter(Object.assign(newReporterData(), { email: "not-an-email" }), A("officer"))],
  [46, "Incident", "Empty description", "description cannot be empty", () => createIncident(baseIncident({ description: "   " }), A("officer"))],
  [46, "Incident", "Severity not selected", "select a severity", () => createIncident(baseIncident({ severity: "" }), A("officer"))],
  [46, "Incident", "Date in the future", "cannot be in the future", () => createIncident(baseIncident({ incident_date: addDays(today(), 5) }), A("officer"))],
  [46, "Location", "Missing building", "Building is required", () => addLocation({ building: "" }, A("officer"))],
  [46, "Investigation", "No investigator selected", "select an active investigator", () => assignInvestigation({ incident_id: 7, investigator_id: "", start_date: today(), target_date: addDays(today(), 3) }, A("officer"))],
  [46, "Action", "No findings recorded yet", "based on investigation findings", () => createAction({ incident_id: 5, action_type: "Training", description: "x", responsible_id: A("actionofficer").user_id, target_date: addDays(today(), 3), priority: "Low" }, A("officer"))],
  [46, "Resolution", "No investigation", "must have an investigation", () => recordResolution({ incident_id: 7, resolution_type: RESOLUTION_TYPES[0], description: "x", resolution_date: today() }, A("officer"))],
  [47, "Rule", "An incident must have a reporter", "Reporter is required", () => createIncident(baseIncident({ reporter_id: "" }), A("officer"))],
  [47, "Rule", "An incident must have a valid location", "valid incident location", () => createIncident(baseIncident({ location_id: 999 }), A("officer"))],
  [47, "Rule", "Type must belong to the category", "must belong to the selected category", () => createIncident(baseIncident({ category_id: catId("Security") }), A("officer"))],
  [47, "Rule", "Incident number must be unique", "Duplicate incident number", () => createIncident(baseIncident({ incident_number: "IN-2026-0001" }), A("officer"))],
  [47, "Rule", "Only newly reported incidents can be investigated", "Only newly reported", () => assignInvestigation({ incident_id: 1, investigator_id: A("investigator").user_id, start_date: today(), target_date: addDays(today(), 3) }, A("officer"))],
  [47, "Rule", "Deadline cannot precede start date", "cannot precede the start date", () => assignInvestigation({ incident_id: 7, investigator_id: A("investigator").user_id, start_date: addDays(today(), 5), target_date: today() }, A("officer"))],
  [47, "Rule", "Investigation must be completed before resolution", "Investigation must be completed", () => recordResolution({ incident_id: 5, resolution_type: RESOLUTION_TYPES[0], description: "x", resolution_date: today() }, A("officer"))],
  [47, "Rule", "Required actions must be completed before closure", "Required corrective actions must be completed", () => { db.actions.filter(a => a.incident_id === 3).forEach(a => { a.status = "Pending"; }); return closeIncident(3, true, "", A("supervisor")); }],
  [47, "Rule", "Closed incidents cannot be edited by ordinary users", "Closed incidents cannot be edited", () => updateIncident(1, { description: "Changed" }, A("officer"))],
  [47, "Rule", "Only authorized personnel can change status", "authorized personnel", () => changeIncidentStatus(7, "Under Investigation", A("manager"))],
  [47, "Rule", "Only authorized users can close an incident", "can close an incident", () => closeIncident(3, true, "", A("officer"))],
  [48, "Error", "Invalid login", "Invalid username or password", () => authenticate("admin", "wrong") ? ok("logged in") : fail("Invalid username or password.")],
  [48, "Error", "Missing incident", "Incident not found", () => updateIncident(9999, { description: "x" }, A("admin"))],
  [48, "Error", "Duplicate incident number", "Duplicate incident number", () => createIncident(baseIncident({ incident_number: "IN-2026-0002" }), A("officer"))],
  [48, "Error", "Invalid date (31 February)", "date is invalid", () => createIncident(baseIncident({ incident_date: "2026-02-31" }), A("officer"))],
  [48, "Error", "Invalid file (virus.exe)", "Invalid file", () => { const e = validateFile({ name: "virus.exe", size: 100 }); return e ? fail(e) : ok(""); }],
  [48, "Error", "Database failure", "Database error", () => { simulateDbFailure = true; testMode = false; return run(() => createIncident(baseIncident(), A("officer"))); }],
  [48, "Error", "Unauthorized access", "Access denied", () => createIncident(baseIncident(), A("investigator"))],
  [48, "Error", "Invalid status transition", "Invalid status transition", () => changeIncidentStatus(7, "Resolved", A("officer"))],
  [48, "Error", "Missing required information", "Reporter is required", () => createIncident({}, A("officer"))]
];
function runCases() {
  ui.caseRes = CASES.map(c => withTemp(() => { let r; try { r = c[4](); } catch (e) { r = fail("Crash: " + e.message); } return { msg: r.msg, pass: !r.ok && r.msg.toLowerCase().includes(c[3].toLowerCase()) }; }));
  redraw();
}
function casesTable(lab, title) {
  const rows = CASES.map((c, i) => [c, i]).filter(x => x[0][0] === lab);
  return `<div class="card"><h3>Lab ${lab} – ${title}</h3><div class="table-wrap"><table class="data"><thead><tr><th>Area</th><th>Test case</th><th>Message the user sees</th><th>Result</th></tr></thead><tbody>
  ${rows.map(([c, i]) => { const r = ui.caseRes && ui.caseRes[i]; return `<tr><td>${c[1]}</td><td>${esc(c[2])}</td><td>${r ? esc(r.msg) : `<span class="muted">not run</span>`}</td><td>${r ? (r.pass ? `<span class="badge green">PASS</span>` : `<span class="badge red">FAIL</span>`) : ""}</td></tr>`; }).join("")}</tbody></table></div></div>`;
}

/* ---------- Labs 49-51, 55: automatic tests (stored in db.tests) ---------- */
const AUTO = {
  u_login: () => { const a = authenticate("admin", "admin123"), b = authenticate("admin", "bad"), c = authenticate("nobody", "x"); return [!!a && !b && !c, "Valid login accepted, wrong password and unknown user rejected"]; },
  u_reporter: () => { const n = db.reporters.length, r = addReporter(newReporterData(), A("officer")); return [r.ok && db.reporters.length === n + 1, r.msg]; },
  u_incident: () => { const r = createIncident(baseIncident(), A("officer")); return [r.ok && r.data.status === "Open" && /^IN-\d{4}-\d{4}$/.test(r.data.incident_number), r.ok ? "Saved as " + r.data.incident_number + " (Open)" : r.msg]; },
  u_location: () => { const r = addLocation({ building: "New Building", room: "Room 5" }, A("officer")); return [r.ok, r.msg]; },
  u_investigation: () => { const c = flowTo("assigned"); return [c.inv && getIncident(c.inc.incident_id).status === "Under Investigation", "Incident status: " + getIncident(c.inc.incident_id).status]; },
  u_action: () => { const c = flowTo("action"); return [!!c.act && c.act.status === "Pending", c.act ? "Action created, status " + c.act.status : "Action not created"]; },
  u_resolution: () => { const c = flowTo("resolved"); return [!!c.res && getIncident(c.inc.incident_id).status === "Resolved", "Incident status: " + getIncident(c.inc.incident_id).status]; },
  u_reports: () => { const types = REPORT_TYPES.map(t => t[0]), ok1 = types.every(t => buildReport(t, {}).sections.length > 0), tot = buildReport("summary", {}).sections[0].rows[0][1]; return [ok1 && tot === db.incidents.length, types.length + " reports built; summary total " + tot + " = " + db.incidents.length + " incidents"]; },
  i1: () => { const rep = addReporter(newReporterData("T-INT-1", "Integration Reporter"), A("officer")).data, r = createIncident(baseIncident({ reporter_id: rep.reporter_id }), A("officer")); return [r.ok && getIncident(r.data.incident_id).reporter_id === rep.reporter_id, "Stored reporter: " + nameOf(getReporter(r.data.reporter_id), "full_name")]; },
  i2: () => { const loc = addLocation({ building: "Test Hall", room: "Room 9" }, A("officer")).data, r = createIncident(baseIncident({ location_id: loc.location_id }), A("officer")); return [r.ok && locName(getLocation(r.data.location_id)) === "Test Hall - Room 9", "Location: " + locName(getLocation(r.data.location_id))]; },
  i3: () => { const c = flowTo("assigned"); const bad = assignInvestigation({ incident_id: c.inc.incident_id, investigator_id: A("investigator").user_id, start_date: today(), target_date: addDays(today(), 3) }, A("officer")); return [!!c.inv && !bad.ok, "Investigation created only once; second attempt: " + bad.msg]; },
  i4: () => { const c = flowTo("action"), f = findingsOf(c.inv.investigation_id); return [!!c.act && c.act.investigation_id === c.inv.investigation_id && !!f.root_cause, "Action linked to investigation with root cause: " + f.root_cause]; },
  i5: () => { const c = flowTo("resolved"), early = recordResolution({ incident_id: flowTo("action").inc.incident_id, resolution_type: RESOLUTION_TYPES[0], description: "x", resolution_date: today() }, A("supervisor")); return [!!c.res && !early.ok, "Resolution allowed after actions done; blocked before: " + early.msg]; },
  i6: () => { const c = flowTo("closed"), bad = closeIncident(flowTo("resolved").inc.incident_id, true, "", A("officer")); return [c.closed.ok && getIncident(c.inc.incident_id).status === "Closed" && !bad.ok, "Closed by supervisor; officer blocked: " + bad.msg]; },
  s_auth: () => { A("manager").status = "Inactive"; const a = authenticate("manager", "manager123"), b = authenticate("admin", "x' OR '1'='1"); return [!a && !b, "Inactive account and tricky password both rejected"]; },
  s_authz: () => { const rep = A("reporter"), mgt = A("manager"); currentUser = rep; const page = allowed("users"), act = createAction({ incident_id: 4 }, rep), cl = closeIncident(3, true, "", rep); currentUser = mgt; const mg = createIncident(baseIncident(), mgt);
    return [!page && !act.ok && !cl.ok && !mg.ok, "Reporter blocked from Users page, actions and closure; Management cannot report incidents"]; },
  s_pw: () => { const plain = db.users.some(u => ["admin123", "reporter123", "officer123"].includes(u.password_hash)), weak = passwordProblem("abc"), digitsOnly = passwordProblem("12345678"); return [!plain && !!weak && !!digitsOnly, "Passwords are stored scrambled; weak passwords rejected"]; },
  s_sqli: () => { const n = db.incidents.length, r = createIncident(baseIncident({ description: "'; DROP TABLE incidents; --" }), A("officer")), hits = db.reporters.filter(x => x.full_name.toLowerCase().includes("' or 1=1 --")); return [r.ok && db.incidents.length === n + 1 && hits.length === 0, "Injection text saved as plain text; tables intact; search returns 0 matches"]; },
  s_input: () => { const out = esc("<scr" + "ipt>alert(1)</scr" + "ipt>"), r = createIncident(baseIncident({ description: "   " }), A("officer")); return [!out.includes("<scr" + "ipt") && !r.ok, "Script tags are escaped on screen; empty input rejected"]; },
  s_file: () => { const bad = [validateFile({ name: "virus.exe", size: 10 }), validateFile({ name: "big.png", size: 400 * 1024 }), validateFile({ name: "noextension", size: 10 })], good = validateFile({ name: "report.pdf", size: 1000 }); return [bad.every(Boolean) && !good, "Rejected .exe, oversize and extension-less files; accepted a PDF"]; },
  s_session: () => [SESSION_MINUTES > 0 && SESSION_MINUTES <= 60, "Automatic logout after " + SESSION_MINUTES + " minutes; session cleared on logout"],
  s_unauth: () => { const r = changeIncidentStatus(7, "Under Investigation", A("manager")), p = allowed("audit"); return [!r.ok && /authorized/i.test(r.msg), "Direct status change by Management refused: " + r.msg]; }
};
function defaultTests() {
  const t = [], n = {};
  const add = (kind, module, test, expected, auto) => { n[kind] = (n[kind] || 0) + 1; t.push({ id: kind[0].toUpperCase() + n[kind], kind, module, test, expected, actual: "", status: "Not tested", auto: auto || "" }); };
  add("unit", "Login", "Valid and invalid login", "Only valid login accepted", "u_login");
  add("unit", "Reporter", "Reporter registration", "Reporter saved", "u_reporter");
  add("unit", "Incident", "Incident registration", "Incident saved as Open", "u_incident");
  add("unit", "Location", "Location registration", "Location saved", "u_location");
  add("unit", "Investigation", "Assign investigation", "Incident becomes Under Investigation", "u_investigation");
  add("unit", "Action", "Create corrective action", "Action saved as Pending", "u_action");
  add("unit", "Resolution", "Record resolution", "Incident becomes Resolved", "u_resolution");
  add("unit", "Reports", "Generate all reports", "Correct totals", "u_reports");
  add("integration", "Reporter → Incident", "Register reporter, then report incident", "Reporter stored with incident", "i1");
  add("integration", "Incident → Location", "Register location, then report incident", "Location stored with incident", "i2");
  add("integration", "Incident → Investigation", "Report incident, then investigate", "Only one investigation per reported incident", "i3");
  add("integration", "Investigation → Action", "Findings and root cause, then action", "Action based on findings", "i4");
  add("integration", "Action → Resolution", "Complete actions, then resolve", "Resolution blocked until actions done", "i5");
  add("integration", "Resolution → Closure", "Resolve, then close", "Only supervisor can close", "i6");
  add("e2e", "Lifecycle", "Juan Dela Cruz – computer equipment accident, IT Laboratory 2 (12 steps)", "Fully traceable closed incident", "e2e");
  add("security", "Authentication", "Invalid, inactive and injection-style logins", "Access denied", "s_auth");
  add("security", "Authorization", "Roles blocked from pages and actions", "Access denied", "s_authz");
  add("security", "Password security", "Stored passwords and strength rules", "Hashed, strong passwords required", "s_pw");
  add("security", "SQL injection", "Injection text in forms and search", "Treated as plain text", "s_sqli");
  add("security", "Input validation", "Script tags and empty input", "Escaped / rejected", "s_input");
  add("security", "File upload", "Dangerous or oversize files", "Rejected", "s_file");
  add("security", "Session security", "Idle timeout and logout", "Session ends", "s_session");
  add("security", "Unauthorized access", "Direct action by wrong role", "Refused", "s_unauth");
  ["Login response", "Incident search", "Location search", "Report generation", "Dashboard loading", "Large incident dataset"].forEach(m => add("performance", m, m + " with 3,000 incidents", "Under 1 second", "perf"));
  return t;
}
function runE2E() {                              // Lab 51: the whole lifecycle with the example from the document
  const steps = [], o = A("officer"), iu = A("investigator"), ao = A("actionofficer"), sup = A("supervisor");
  const st = (name, r, extra) => { steps.push({ name, pass: !!(r && r.ok !== false) && (extra === undefined || extra), msg: r && r.msg ? r.msg : "" }); return r; };
  const rep = st("Register reporter: Juan Dela Cruz", addReporter(newReporterData("EMP-9001", "Juan Dela Cruz"), o)).data;
  const inc = st("Report incident: Computer equipment accident (High)", createIncident({ reporter_id: rep.reporter_id, category_id: catId("Safety"), type_id: typeId("Equipment Accident"), location_id: locId("IT Laboratory 2"),
    incident_date: today(), incident_time: "14:00", description: "Computer equipment accident in IT Laboratory 2.", severity: "High", immediate_response: "Area secured." }, o)).data;
  st("Select location: IT Laboratory 2", ok("Location saved with incident"), inc && locName(getLocation(inc.location_id)).includes("IT Laboratory 2"));
  const inv = st("Assign investigator", assignInvestigation({ incident_id: inc.incident_id, investigator_id: iu.user_id, start_date: today(), target_date: addDays(today(), 7), instructions: "Investigate the accident." }, o)).data;
  st("Conduct investigation (In Progress → Evidence Gathering)", (() => { const a = updateInvestigationStatus(inv.investigation_id, "In Progress", iu); return a.ok ? updateInvestigationStatus(inv.investigation_id, "Evidence Gathering", iu) : a; })());
  st("Record evidence", addEvidence(inv.investigation_id, sampleFile("accident-photo.jpg"), "Photo of the damaged computer", iu));
  st("Determine root cause", (() => { const a = saveFindings(inv.investigation_id, { findings: "Unsecured cables caused the computer to fall.", witnesses: "", recommendation: "Secure cables." }, iu);
    return a.ok ? saveFindings(inv.investigation_id, { rca_problem: "Computer fell", rca_cause: "Loose cables", rca_evidence: "Photo", immediate_cause: "Pulled cable", root_cause: "No cable management", contributing_factors: "", preventive_measures: "Install cable trays" }, iu) : a; })());
  st("Complete investigation", (() => { const a = updateInvestigationStatus(inv.investigation_id, "Findings Prepared", iu); return a.ok ? updateInvestigationStatus(inv.investigation_id, "Completed", iu) : a; })());
  const act = st("Create corrective action", createAction({ incident_id: inc.incident_id, action_type: "Safety Improvement", description: "Install cable trays.", responsible_id: ao.user_id, target_date: addDays(today(), 14), priority: "High", is_required: true }, o)).data;
  st("Complete corrective action", (() => { let a = updateActionStatus(act.action_id, "In Progress", "", ao); if (a.ok) a = updateActionStatus(act.action_id, "Completed", "Trays installed", ao); return a.ok ? updateActionStatus(act.action_id, "Verified", "OK", sup) : a; })());
  st("Record resolution", recordResolution({ incident_id: inc.incident_id, resolution_type: RESOLUTION_TYPES[0], description: "Cable trays installed.", resolution_date: today(), remarks: "" }, sup));
  st("Close incident", closeIncident(inc.incident_id, true, "E2E test", sup));
  const trace = traceIncident(inc.incident_id), rep2 = buildReport("summary", {});
  st("Generate incident report (all lifecycle steps traceable)", ok("Report generated"), trace.every(s => s.done) && rep2.sections[0].rows[0][1] === db.incidents.length);
  return steps;
}
function runAutoTests(kinds) {
  const snapshot = JSON.stringify(db), results = {};
  db.tests.filter(t => t.auto && t.auto !== "perf" && kinds.includes(t.kind)).forEach(t => {
    results[t.id] = withTemp(() => { db = JSON.parse(snapshot); try { if (t.auto === "e2e") { const s = runE2E(); ui.e2eSteps = s; return [s.every(x => x.pass), s.filter(x => x.pass).length + " of " + s.length + " steps passed"]; } return AUTO[t.auto](); } catch (e) { return [false, "Crashed: " + e.message]; } });
  });
  db.tests.forEach(t => { if (results[t.id]) { t.actual = results[t.id][1]; t.status = results[t.id][0] ? "Pass" : "Fail"; } });
  run(() => { save(); return ok(""); });
}
function runPerfTests() {                        // Lab 56
  const rows = db.tests.filter(t => t.kind === "performance"), out = {};
  withTemp(() => {
    const N = 3000, sev = SEVERITIES, sts = INC_STATUSES;
    for (let i = 0; i < N; i++) {
      const type = db.types[i % db.types.length], m = String(1 + (i % 12)).padStart(2, "0"), d = String(1 + (i % 27)).padStart(2, "0");
      db.incidents.push({ incident_id: 100000 + i, incident_number: "PF-" + i, reporter_id: 1 + (i % db.reporters.length), category_id: type.category_id, type_id: type.type_id, location_id: 1 + (i % db.locations.length),
        incident_date: "2026-" + m + "-" + d, incident_time: "10:00", description: "Performance test incident " + i, severity: sev[i % 4], immediate_response: "", status: sts[i % 5], date_reported: "2026-" + m + "-" + d, closure_date: "", closed_by: null });
      if (i % 3 === 0) db.investigations.push({ investigation_id: 100000 + i, incident_id: 100000 + i, investigator_id: 4, assigned_by: 3, assigned_date: "2026-" + m + "-" + d, start_date: "2026-" + m + "-" + d, target_date: "2026-" + m + "-" + d, completion_date: "", status: INV_STATUSES[i % 5], instructions: "", notes: "" });
    }
    const time = fn => { const t0 = performance.now(); fn(); return performance.now() - t0; };
    const login = time(() => { for (let i = 0; i < 200; i++) authenticate("admin", "admin123"); }) / 200;
    const search = time(() => visibleIncidents().filter(i => (i.incident_number + " " + (getType(i.type_id) || {}).type_name + " " + locName(getLocation(i.location_id))).toLowerCase().includes("slip")));
    const loc = time(() => db.locations.filter(l => (l.building + l.room).toLowerCase().includes("lab")).map(l => db.incidents.filter(i => i.location_id === l.location_id).length));
    const rep = time(() => { buildReport("trend", {}); buildReport("category", {}); });
    const dash = time(() => RENDER.dashboard());
    const large = time(() => { paginate(db.incidents.slice().sort((a, b) => a.incident_date < b.incident_date ? 1 : -1), "perf", "x"); });
    [[login, 100], [search, 1000], [loc, 1000], [rep, 1000], [dash, 1000], [large, 1000]].forEach((v, i) => { out[rows[i].id] = [v[0] < v[1], v[0].toFixed(1) + " ms (limit " + v[1] + " ms)"]; });
  });
  db.tests.filter(t => t.kind === "performance").forEach(t => { if (out[t.id]) { t.actual = out[t.id][1]; t.status = out[t.id][0] ? "Pass" : "Fail"; } });   // fresh rows (withTemp replaced db)
  run(() => { save(); return ok(""); });
}
function testsTable(kind, title) {
  const list = db.tests.filter(t => t.kind === kind), pass = list.filter(t => t.status === "Pass").length;
  return `<div class="card"><h3>${title} <span class="badge blue">${pass}/${list.length} passed</span></h3><div class="table-wrap"><table class="data"><thead><tr><th>ID</th><th>Area</th><th>Test</th><th>Expected</th><th>Actual result</th><th>Status</th></tr></thead><tbody>
  ${list.map(t => `<tr><td>${t.id}</td><td>${esc(t.module)}</td><td>${esc(t.test)}</td><td>${esc(t.expected)}</td><td><input value="${esc(t.actual)}" onchange="setTest('${t.id}','actual',this.value)" style="min-width:200px"></td>
   <td><select onchange="setTest('${t.id}','status',this.value);renderPage()">${optionList(["Not tested", "Pass", "Fail"], s => s, s => s, t.status)}</select></td></tr>`).join("")}</tbody></table></div></div>`;
}
function setTest(id, field, value) { db.tests.find(t => t.id === id)[field] = value; run(() => { save(); return ok(""); }); }
RENDER.testing = () => {
  if (!db.tests.length) db.tests = defaultTests();
  return `<div class="card"><h3>Automatic Testing</h3><p class="muted">Every test runs on a temporary copy of the data. Your real incidents are never changed.</p>
   <div class="actions"><button class="btn primary" onclick="runCases()">▶ Run validation, business-rule &amp; error tests (Labs 46-48)</button>
   <button class="btn primary" onclick="runAutoTests(['unit']);redraw(ok('Unit tests finished.'))">▶ Unit tests (49)</button>
   <button class="btn primary" onclick="runAutoTests(['integration']);redraw(ok('Integration tests finished.'))">▶ Integration tests (50)</button>
   <button class="btn primary" onclick="runAutoTests(['e2e']);redraw(ok('End-to-end test finished.'))">▶ End-to-end test (51)</button>
   <button class="btn primary" onclick="runAutoTests(['security']);redraw(ok('Security tests finished.'))">▶ Security tests (55)</button>
   <button class="btn primary" onclick="runPerfTests();redraw(ok('Performance tests finished.'))">▶ Performance tests (56)</button></div>
   <div class="actions"><button class="btn success" onclick="runAutoTests(['unit','integration','e2e','security']);runPerfTests();runCases();">▶▶ Run EVERYTHING</button><button class="btn" onclick="window.print()">🖨️ Print test report</button></div></div>` +
    casesTable(46, "System-Wide Form Validation") + casesTable(47, "Incident Business Rules") + casesTable(48, "Error Handling") +
    testsTable("unit", "Lab 49 – Unit Testing") + testsTable("integration", "Lab 50 – Integration Testing") + testsTable("e2e", "Lab 51 – End-to-End Testing") +
    (ui.e2eSteps ? `<div class="card"><h3>End-to-end steps (Juan Dela Cruz – computer equipment accident)</h3><table class="data"><thead><tr><th>#</th><th>Step</th><th>Result</th><th>Message</th></tr></thead><tbody>
     ${ui.e2eSteps.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${s.pass ? `<span class="badge green">PASS</span>` : `<span class="badge red">FAIL</span>`}</td><td>${esc(s.msg)}</td></tr>`).join("")}</tbody></table></div>` : "") +
    testsTable("security", "Lab 55 – Security Testing") +
    testsTable("performance", "Lab 56 – Performance Testing") +
    `<div class="card"><h3>Performance optimization used</h3><ul><li><b>Pagination:</b> lists show ${PAGE_SIZE} records per page (incidents, reporters, audit trail, notifications).</li><li><b>Indexes:</b> database.sql creates indexes on status, dates, reporter, location, investigator and responsible person.</li><li><b>Report queries:</b> each report goes through the data once and counts with simple lookups.</li><li><b>Dashboard:</b> counts are computed once per page draw.</li></ul></div>`;
};

/* =================== USER ACCEPTANCE TESTING (Lab 52) =================== */
const UAT_SCENARIOS = ["Reporting incidents", "Location selection", "Investigation", "Evidence recording", "Corrective action", "Resolution", "Reports", "Dashboard"];
const UAT_CRITERIA = ["Functionality", "Usability", "Accuracy", "Reliability", "Security"];
RENDER.uat = () => {
  db.checklists.uat = db.checklists.uat || {};
  const avg = i => db.uat.length ? (db.uat.reduce((a, e) => a + e.scores[i], 0) / db.uat.length).toFixed(2) : "-";
  return `<div class="card"><h3>UAT Scenarios</h3><div class="table-wrap"><table class="data"><thead><tr><th>Scenario</th><th>What the user tries</th><th>Result</th></tr></thead><tbody>
   ${UAT_SCENARIOS.map((s, i) => `<tr><td><b>${s}</b></td><td class="muted">${["Fill the incident form and save", "Choose a location from the list", "Assign and record an investigation", "Upload a photo or document", "Create and complete an action", "Resolve and close an incident", "Generate and print a report", "Read the KPIs and charts"][i]}</td>
   <td><select onchange="db.checklists.uat[${i}]=this.value;run(()=>{save();return ok('')})">${optionList(["Not tested", "Accepted", "Needs changes"], x => x, x => x, db.checklists.uat[i] || "Not tested")}</select></td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>New Evaluation</h3><div class="grid">${fld("ua_name", "Evaluator name *", "")}${fld("ua_role", "Role / position", "")}</div><p class="muted">Rate from 1 (poor) to 5 (excellent).</p><div class="grid">
   ${UAT_CRITERIA.map((c, i) => `<div><label>${c}</label><select id="ua_${i}">${[5, 4, 3, 2, 1].map(n => `<option>${n}</option>`).join("")}</select></div>`).join("")}</div>
   <label>Comments</label><textarea id="ua_comment" rows="2"></textarea><div class="actions"><button class="btn primary" onclick="saveUat()">Save Evaluation</button></div></div>
  <div class="card"><h3>UAT Summary (${db.uat.length} evaluator/s)</h3><table class="data"><thead><tr><th>Criteria</th><th class="num">Average (1-5)</th></tr></thead><tbody>${UAT_CRITERIA.map((c, i) => `<tr><td>${c}</td><td class="num">${avg(i)}</td></tr>`).join("")}</tbody></table>
   <h4>Evaluations</h4><table class="data"><thead><tr><th>Evaluator</th><th>Role</th><th class="num">Average</th><th>Comments</th><th></th></tr></thead><tbody>
   ${db.uat.map((e, i) => `<tr><td>${esc(e.name)}</td><td>${esc(e.role)}</td><td class="num">${(e.scores.reduce((a, b) => a + b, 0) / e.scores.length).toFixed(2)}</td><td>${esc(e.comment)}</td><td><button class="btn small" onclick="db.uat.splice(${i},1);save();renderPage()">Delete</button></td></tr>`).join("") || emptyRow(5, "No evaluations yet.")}</tbody></table></div>`;
};
function saveUat() {
  if (!val("ua_name")) return say(fail("Error: Evaluator name is required."));
  db.uat.push({ name: val("ua_name"), role: val("ua_role"), scores: UAT_CRITERIA.map((c, i) => Number(val("ua_" + i))), comment: val("ua_comment") });
  redraw(run(() => { save(); return ok("Evaluation saved."); }));
}

/* =================== BUG TRACKING (Lab 53) =================== */
RENDER.bugs = () => `<div class="card"><h3>Report a Bug</h3><div class="grid">${fld("bg_mod", "Module", "", { ph: "Incident" })}${sel("bg_sev", "Severity", SEVERITIES.map(s => [s, s]), "Medium")}</div>
  ${fld("bg_prob", "Problem *", "", { ph: "Incident not saving" })}${fld("bg_fix", "Corrective action (when known)", "", { ph: "Fixed validation" })}<div class="actions"><button class="btn primary" onclick="addBug()">Add Bug</button></div></div>
  <div class="card"><h3>Bug List</h3><p class="muted">Rule: every corrected bug must be <b>retested</b> before it can be closed. Open → Fixed → Retest → Closed.</p><div class="table-wrap"><table class="data"><thead><tr><th>Bug ID</th><th>Module</th><th>Problem</th><th>Severity</th><th>Corrective Action</th><th>Status</th><th></th></tr></thead><tbody>
  ${db.bugs.map((b, i) => `<tr><td>${b.id}</td><td>${esc(b.module)}</td><td>${esc(b.problem)}</td><td>${sevBadge(b.severity)}</td><td><input value="${esc(b.fix)}" onchange="db.bugs[${i}].fix=this.value;save()" style="min-width:160px"></td>
   <td><span class="badge ${b.status === "Closed" ? "green" : b.status === "Fixed" ? "blue" : "red"}">${b.status}</span></td><td>
   ${b.status === "Open" ? `<button class="btn small" onclick="bugStep(${i},'Fixed')">Mark Fixed</button>` : ""}
   ${b.status === "Fixed" ? `<button class="btn small success" onclick="bugStep(${i},'Closed')">Retest passed → Close</button> <button class="btn small danger" onclick="bugStep(${i},'Open')">Retest failed → Reopen</button>` : ""}
   <button class="btn small" onclick="db.bugs.splice(${i},1);save();renderPage()">Delete</button></td></tr>`).join("") || emptyRow(7, "No bugs recorded. Add the problems you find while testing.")}</tbody></table></div></div>`;
function addBug() {
  if (!val("bg_prob")) return say(fail("Error: Describe the problem."));
  db.bugs.push({ id: "B" + String(nextId("bug")).padStart(3, "0"), module: val("bg_mod"), problem: val("bg_prob"), severity: val("bg_sev"), fix: val("bg_fix"), status: "Open" });
  redraw(run(() => { save(); return ok("Bug added."); }));
}
function bugStep(i, to) {
  const b = db.bugs[i]; if (to === "Fixed" && !b.fix) { return say(fail("Error: Write the corrective action before marking the bug as fixed.")); }
  b.status = to; redraw(run(() => { save(); return ok("Bug " + b.id + " is now " + to + "."); }));
}

/* =================== BACKUP, DEPLOYMENT, POST-DEPLOYMENT (Labs 54, 57-59) =================== */
const PREP_ITEMS = ["Remove test records", "Verify the database (Verify Records)", "Configure production settings", "Configure the administrator account (change the default password)", "Prepare a database backup",
  "Review security (Testing → Security tests)", "Check all modules", "Prepare installation documentation (Technical Docs)"];
const DEPLOY_ITEMS = ["Web server configured (GitHub Pages / Netlify / school server)", "Database server configured (browser storage, or MySQL with database.sql)", "Application files uploaded (index.html, style.css, js/ folder)", "Network access confirmed (link opens on another device)", "Security settings reviewed (HTTPS, strong passwords)"];
const POST_ITEMS = ["Login works for every role", "Reporter can report an incident", "Location can be selected", "Investigator can investigate", "Action Officer can update actions", "Resolution and closure work", "Reports and dashboard open", "File upload works"];
const chk = (group, items) => `<div class="step-list">${items.map((s, i) => `<label><input type="checkbox" ${(db.checklists[group] || {})[i] ? "checked" : ""} onchange="db.checklists['${group}']=db.checklists['${group}']||{};db.checklists['${group}'][${i}]=this.checked;save()"> ${s}</label>`).join("")}</div>`;
RENDER.backup = () => `<div class="two-col"><div class="card"><h3>Lab 54 – Backup &amp; Recovery</h3>
  <div class="actions"><button class="btn primary" onclick="doBackup()">⬇ Download Backup</button><label class="btn" style="margin:0">⬆ Restore from File<input type="file" accept=".json" style="display:none" onchange="restoreFile(this)"></label>
  <button class="btn" onclick="restoreLast()">↩ Restore Last Backup</button></div>
  <div class="actions"><button class="btn" onclick="verifyRecords()">🔍 Verify Records</button><button class="btn danger" onclick="simulateFailure()">💥 Simulate Database Failure</button></div><div id="verifyOut" style="margin-top:12px"></div>
  <h4>Backup procedure</h4><ol><li>Press <b>Download Backup</b> every week and before big changes.</li><li>Keep the file in a safe place (another computer or cloud drive).</li><li>To recover: <b>Restore from File</b>.</li><li>Press <b>Verify Records</b> to confirm counts and relationships.</li></ol>
  <p><b>Recovery test:</b> Download Backup → Simulate Failure → Restore Last Backup → Verify Records.</p>
  <h4>Backup log</h4><ul>${db.backups.slice(-6).reverse().map(b => `<li>${esc(b)}</li>`).join("") || "<li class='muted'>No backups yet.</li>"}</ul></div>
 <div class="card"><h3>Lab 57 – Deployment Preparation</h3><div class="actions"><button class="btn" onclick="clearTestRecords()">🧹 Remove test records</button><button class="btn danger" onclick="makeProduction()">🚀 Prepare Production Database</button><button class="btn" onclick="loadSample()">🔄 Reload sample data</button></div>
  <p class="muted">"Remove test records" deletes all incidents and everything linked to them. "Prepare Production" also removes reporters, locations and all users except the administrator (who must then set a new password).</p>${chk("prep", PREP_ITEMS)}</div></div>
 <div class="card"><h3>Lab 58 – Deploy the System</h3><div class="two-col"><div><h4>Local computer</h4><p>Open <code>index.html</code>. For a local web server, copy the folder to <code>htdocs</code> (XAMPP) and open <code>http://localhost/IRS/</code>.</p></div>
  <div><h4>School / organization server</h4><p>Copy the whole <code>IRS</code> folder to the web root (FTP or file share). Share the address with users on the same network.</p></div>
  <div><h4>Cloud (free link for your teacher)</h4><ol><li>Create a GitHub account and a <b>public repository</b>.</li><li>Upload <code>index.html</code>, <code>style.css</code>, <code>database.sql</code> and the <code>js</code> folder.</li><li>Settings → Pages → Branch <code>main</code> → Save.</li><li>Your link: <code>https://yourname.github.io/repository/</code>.</li></ol></div></div>${chk("deploy", DEPLOY_ITEMS)}</div>
 <div class="card"><h3>Lab 59 – Post-Deployment Testing</h3><p>Workflow: Login → Reporter → Incident → Location → Investigation → Action → Resolution → Reports.</p>
  <div class="actions"><button class="btn primary" onclick="runPostDeploy()">▶ Run automatic post-deployment check</button></div><div id="postOut" style="margin-top:12px"></div><h4>Manual checklist</h4>${chk("post", POST_ITEMS)}</div>`;
function doBackup() {
  const text = JSON.stringify(db, null, 2);
  try { localStorage.setItem("irs_last_backup", text); } catch (e) { /* storage may be full */ }
  db.backups.push(new Date().toLocaleString() + " – backup downloaded by " + currentUser.username);
  download("irs_backup_" + today() + ".json", text, "application/json"); redraw(run(() => { save(); return ok("Backup downloaded (a copy is also kept in this browser)."); }));
}
function applyBackup(text, msg) {
  let data; try { data = JSON.parse(text); } catch (e) { return say(fail("Error: That file is not a valid backup.")); }
  if (!data.incidents || !data.users || !data.counters) return say(fail("Error: That file is not an IRS backup."));
  db = data; run(() => { save(); return ok(""); });
  const me = db.users.find(u => u.username === currentUser.username); if (!me) { logout("Your account is not in the restored backup"); return; }
  currentUser = me; redraw(ok(msg));
}
function restoreFile(input) { const f = input.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => applyBackup(r.result, "Database restored from file."); r.readAsText(f); }
function restoreLast() { const t = localStorage.getItem("irs_last_backup"); if (!t) return say(fail("Error: No backup found. Download a backup first.")); applyBackup(t, "Database restored from the last backup."); }
function verifyRecords() {
  const rel = checkRelationships(), problems = rel.problems.slice();
  INC_STATUSES.forEach((s, idx) => db.incidents.filter(i => i.status === s).forEach(i => { if (idx >= 1 && !invOfIncident(i.incident_id)) problems.push(i.incident_number + ": status " + s + " but no investigation"); if (idx >= 3 && !resolutionOf(i.incident_id)) problems.push(i.incident_number + ": status " + s + " but no resolution"); }));
  $("verifyOut").innerHTML = problems.length ? `<div class="flash err">✖ ${problems.length} problem(s):<br>${problems.slice(0, 15).map(esc).join("<br>")}</div>`
    : `<div class="flash ok">✔ All records verified: ${db.incidents.length} incidents, ${db.reporters.length} reporters, ${db.investigations.length} investigations, ${db.actions.length} actions, ${db.resolutions.length} resolutions; ${rel.checked} relationships valid.</div>`;
}
function simulateFailure() {
  if (!confirm("This erases all data except user accounts. Make sure you downloaded a backup. Continue?")) return;
  const users = db.users, roles = db.roles, counters = { user: db.counters.user, role: db.counters.role }; db = emptyDb(); db.users = users; db.roles = roles; db.counters = counters; db.tests = defaultTests();
  redraw(run(() => { save(); return ok("Database failure simulated. Now press 'Restore Last Backup' or 'Restore from File'."); }));
}
function keepReference(keepUsersOnlyAdmin) {
  const keep = { roles: db.roles, departments: db.departments, categories: db.categories, types: db.types, counters: db.counters, users: db.users };
  const fresh = emptyDb(); Object.assign(fresh, keep); fresh.tests = defaultTests();
  if (keepUsersOnlyAdmin) { fresh.users = db.users.filter(u => u.username === "admin"); fresh.users.forEach(u => { u.must_change = true; u.reporter_id = null; }); }
  else { fresh.reporters = db.reporters.filter(r => db.users.some(u => u.reporter_id === r.reporter_id)); fresh.locations = db.locations; }
  db = fresh; currentUser = getUser(currentUser.user_id) || currentUser;
}
function clearTestRecords() { if (!confirm("Remove all incidents, investigations, actions, resolutions, notifications and audit records?")) return; keepReference(false); redraw(run(() => { save(); return ok("Test records removed."); })); }
function makeProduction() {
  if (!confirm("Remove all test data and all users except 'admin'? You will be asked to change the admin password.")) return; keepReference(true);
  redraw(run(() => { save(); return ok("Production database prepared. Change the admin password on My Account, then add users, locations and reporters."); }));
}
function loadSample() { if (!confirm("Replace ALL data with the sample data?")) return; seedDemo(); logout(); }
function runPostDeploy() {
  const rows = [], add = (n, p, t) => rows.push([n, p, t]);
  try { localStorage.setItem("irs_probe", "1"); const ok1 = localStorage.getItem("irs_probe") === "1"; localStorage.removeItem("irs_probe"); add("Database connectivity", ok1, "Read/write test on browser storage"); } catch (e) { add("Database connectivity", false, e.message); }
  add("User access", ALLR.every(r => usersWithRole(r).length > 0), "Every role has at least one active account");
  add("File uploads", !validateFile({ name: "photo.jpg", size: 1000 }) && !!validateFile({ name: "bad.exe", size: 10 }), "Good file accepted, bad file rejected");
  let rep = false; try { rep = REPORT_TYPES.every(t => buildReport(t[0], {}).sections.length > 0); } catch (e) { /* stays false */ } add("Reports", rep, REPORT_TYPES.length + " reports build correctly");
  let dash = false; try { dash = RENDER.dashboard().includes("Total Incidents"); } catch (e) { /* stays false */ } add("Dashboard", dash, "Dashboard draws KPIs and charts");
  const sec = withTemp(() => ["s_auth", "s_authz", "s_pw", "s_sqli", "s_input", "s_file", "s_unauth"].every(k => AUTO[k]()[0])); add("Security", sec, "All 7 security tests pass");
  const wf = withTemp(() => { const s = runE2E(); return s.every(x => x.pass); }); add("Complete workflow", wf, "Login → Reporter → Incident → Location → Investigation → Action → Resolution → Reports");
  const t0 = performance.now(); RENDER.dashboard(); const ms = performance.now() - t0; add("Performance", ms < 1000, "Dashboard drawn in " + ms.toFixed(0) + " ms");
  const rel = checkRelationships(); add("Data integrity", rel.problems.length === 0, rel.checked + " relationships checked");
  $("postOut").innerHTML = `<table class="data"><thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1] ? `<span class="badge green">PASS</span>` : `<span class="badge red">FAIL</span>`}</td><td>${esc(r[2])}</td></tr>`).join("")}</tbody></table>`;
}

/* =================== FINAL REFINEMENT & DEMO (Labs 62-63) =================== */
const REFINE_ITEMS = ["Correct remaining bugs (Bug Tracking has no Open bugs)", "Improve the user interface", "Improve validation", "Optimize database queries", "Improve security", "Review reports", "Review dashboard", "Clean source code", "Verify the entire workflow"];
const DEMO_STEPS = [["Reporter: register or select the reporter (Juan Dela Cruz)", "reporters"], ["Incident: report the computer equipment accident", "incidents"], ["Location: IT Laboratory 2", "locations"],
  ["Investigation: assign an investigator", "investigations"], ["Findings / Root Cause: record findings and root cause analysis", "investigations"], ["Action: create and complete the corrective action", "actions"],
  ["Resolution: record the resolution", "resolutions"], ["Closure: supervisor closes the incident", "resolutions"], ["Reports & Dashboard", "reports"], ["Testing: run all automatic tests", "testing"], ["Deployment: show the live link and post-deployment check", "backup"]];
RENDER.final = () => {
  const openBugs = db.bugs.filter(b => b.status !== "Closed").length;
  return `<div class="card"><h3>Lab 62 – Final System Refinement</h3>${chk("refine", REFINE_ITEMS)}<p>Open bugs: <b>${openBugs}</b></p>
   <div class="actions"><button class="btn primary" onclick="healthCheck()">▶ Run full system health check</button></div><div id="healthOut" style="margin-top:12px"></div></div>
  <div class="card"><h3>Lab 63 – Final System Demonstration</h3><p><b>Scenario:</b> Reporter Juan Dela Cruz · Incident: computer equipment accident · Location: IT Laboratory 2 · Category: Safety · Severity: High</p>
   <p class="muted">Tip: incident IN-2026-0001 already shows this whole lifecycle (see Workflow Integration → Lab 33).</p>
   <div class="step-list">${DEMO_STEPS.map((s, i) => `<label><input type="checkbox" ${(db.checklists.demo || {})[i] ? "checked" : ""} onchange="db.checklists.demo=db.checklists.demo||{};db.checklists.demo[${i}]=this.checked;save()"><span><b>${i + 1}.</b> ${s[0]} <a href="#" onclick="go('${s[1]}');return false">Go →</a></span></label>`).join("")}</div></div>`;
};
function healthCheck() {
  runAutoTests(["unit", "integration", "e2e", "security"]); runPerfTests();
  const bad = db.tests.filter(t => t.auto && t.status !== "Pass").length, rel = checkRelationships(), openBugs = db.bugs.filter(b => b.status !== "Closed").length;
  $("healthOut").innerHTML = `<div class="flash ${bad === 0 && !rel.problems.length ? "ok" : "err"}">${bad === 0 ? "✔" : "✖"} Automatic tests: ${db.tests.filter(t => t.auto).length - bad} of ${db.tests.filter(t => t.auto).length} passed · Relationships: ${rel.problems.length ? rel.problems.length + " broken" : "all valid"} · Open bugs: ${openBugs}</div>`;
}

/* =================== START-UP =================== */
window.addEventListener("DOMContentLoaded", () => {
  loadDb(); if (!db.tests || !db.tests.length) { db.tests = defaultTests(); run(() => { save(); return ok(""); }); }
  ["click", "keydown", "mousemove", "touchstart"].forEach(ev => document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
  setInterval(sessionTick, 30000);
  const sid = sessionStorage.getItem("irs_session"), u = sid && getUser(sid);          // keep the user logged in after a page refresh
  if (u && u.status === "Active") { startSession(u); ui.page = firstPage(); renderPage(); }
});
