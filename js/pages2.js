"use strict";
/* =====================================================================
   pages2.js - INVESTIGATIONS, ACTIONS, RESOLUTIONS, INTEGRATION, REPORTS
   (Labs 14-33, 38-44)
   ===================================================================== */

/* =================== INVESTIGATIONS (Labs 14-19) =================== */
const visibleInvestigations = () => roleName(currentUser) === R.INV ? db.investigations.filter(v => v.investigator_id === currentUser.user_id) : db.investigations;
RENDER.investigations = () => ui.viewInv ? investigationDetail(ui.viewInv) : investigationList();
function investigationList() {
  const open = db.incidents.filter(i => i.status === "Open" && !invOfIncident(i.incident_id));
  const form = can("investigation_assign") ? `<div class="card"><h3>Assign an Investigation (Labs 14-15)</h3>
    ${open.length ? `<div class="grid">
    ${sel("ai_inc", "Incident * (only newly reported incidents)", open.map(i => [i.incident_id, i.incident_number + " - " + (getType(i.type_id) || {}).type_name + " (" + i.severity + ")"]), ui.assignIncident, "-- Select incident --")}
    ${sel("ai_user", "Investigator *", usersWithRole(R.INV).map(u => [u.user_id, u.full_name]), "", "-- Select investigator --")}
    ${fld("ai_start", "Investigation Start Date *", today(), { type: "date" })}${fld("ai_target", "Target Completion Date *", "", { type: "date" })}
    ${area("ai_instr", "Investigation Instructions", "", 2)}</div>
    <div class="actions"><button class="btn primary" onclick="doAssign()">Assign &amp; Notify Investigator</button></div>` : `<p class="muted">There are no newly reported incidents waiting for an investigator.</p>`}</div>` : "";
  const list = visibleInvestigations().slice().sort((a, b) => a.target_date < b.target_date ? -1 : 1);
  return form + `<div class="card"><h3>Investigation Monitoring (Lab 18)</h3><div class="table-wrap"><table class="data"><thead><tr><th>Incident</th><th>Investigator</th><th>Start</th><th>Deadline</th><th>Current Status</th><th>Completed</th><th></th></tr></thead><tbody>
   ${list.length ? list.map(v => { const inc = getIncident(v.incident_id); return `<tr class="${invOverdue(v) ? "row-bad" : ""}"><td><b>${esc(inc.incident_number)}</b><br><span class="muted">${esc(nameOf(getType(inc.type_id), "type_name"))}</span></td>
    <td>${esc(nameOf(getUser(v.investigator_id), "full_name"))}</td><td>${v.start_date}</td><td>${v.target_date}${invOverdue(v) ? ` <span class="badge red">OVERDUE</span>` : ""}</td>
    <td><span class="badge ${v.status === "Completed" ? "green" : "orange"}">${esc(v.status)}</span></td><td>${v.completion_date || "-"}</td>
    <td><button class="btn small" onclick="ui.viewInv=${v.investigation_id};renderPage()">Open</button></td></tr>`; }).join("") : emptyRow(7, "No investigations.")}</tbody></table></div></div>`;
}
function doAssign() {
  const r = run(() => assignInvestigation({ incident_id: val("ai_inc"), investigator_id: val("ai_user"), start_date: val("ai_start"), target_date: val("ai_target"), instructions: $("ai_instr").value.trim() }, currentUser));
  if (r.ok) { ui.assignIncident = ""; redraw(r); } else say(r);
}
function investigationDetail(id) {
  const v = getInvestigation(id), inc = getIncident(v.incident_id), f = findingsOf(id) || {};
  if (roleName(currentUser) === R.INV && v.investigator_id !== currentUser.user_id) return `<div class="flash err">You can only open investigations assigned to you.</div>`;
  const edit = canWorkOn(v, currentUser) && v.status !== "Completed", ci = INV_STATUSES.indexOf(v.status), nextSt = INV_STATUSES[ci + 1];
  const ev = db.evidence.filter(e => e.investigation_id === id), seeEv = validateEvidenceAccess(v, currentUser);
  const block = (label, key, rows) => edit ? `<div style="grid-column:1/-1"><label>${label}</label><textarea id="fd_${key}" rows="${rows || 2}">${esc(f[key] || "")}</textarea></div>` : `<div style="grid-column:1/-1"><b>${label}:</b><br>${pre(f[key])}</div>`;
  return `<div class="actions" style="margin:0 0 14px"><button class="btn" onclick="ui.viewInv=null;renderPage()">← Back</button>
    <button class="btn" onclick="openIncident(${inc.incident_id})">Open incident ${esc(inc.incident_number)}</button></div>
   <div class="card"><h3>Investigation of ${esc(inc.incident_number)} ${invOverdue(v) ? `<span class="badge red">OVERDUE</span>` : ""}</h3>
    <div class="tracker">${INV_STATUSES.map((s, i) => `<div class="st ${i < ci || v.status === "Completed" ? "done" : i === ci ? "now" : ""}">${s}</div>`).join("")}</div>
    <p><b>Investigator:</b> ${esc(nameOf(getUser(v.investigator_id), "full_name"))} · <b>Assigned:</b> ${v.assigned_date} by ${esc(nameOf(getUser(v.assigned_by), "full_name"))} · <b>Start:</b> ${v.start_date} · <b>Deadline:</b> ${v.target_date}${v.completion_date ? " · <b>Completed:</b> " + v.completion_date : ""}</p>
    <p><b>Incident:</b> ${pre(inc.description)}</p><p><b>Instructions:</b> ${pre(v.instructions)}</p>
    ${edit && nextSt ? `<div class="actions"><button class="btn success" onclick="advanceInv(${id},'${nextSt}')">Move to: ${nextSt} →</button></div>` : ""}</div>
   <div class="card"><h3>Investigation Notes</h3>${edit ? `<textarea id="inv_notes" rows="3">${esc(v.notes)}</textarea><div class="actions"><button class="btn small" onclick="saveNotesUi(${id})">Save Notes</button></div>` : pre(v.notes)}</div>
   <div class="card"><h3>Findings (Lab 16)</h3><div class="grid">${block("Findings *", "findings", 3)}${block("Witnesses", "witnesses")}${block("Investigator Recommendation", "recommendation")}</div>
    ${edit ? `<div class="actions"><button class="btn primary" onclick="saveFindingsUi(${id})">Save Findings</button></div>` : ""}</div>
   <div class="card"><h3>Root Cause Analysis (Lab 19)</h3><p class="muted">Problem → Cause → Evidence → Root Cause → Recommendation</p><div class="grid">
    ${block("1. Problem *", "rca_problem")}${block("2. Cause *", "rca_cause")}${block("3. Evidence", "rca_evidence")}${block("Immediate cause", "immediate_cause")}
    ${block("4. Root cause *", "root_cause")}${block("Contributing factors", "contributing_factors")}${block("5. Recommended preventive measures", "preventive_measures")}</div>
    ${edit ? `<div class="actions"><button class="btn primary" onclick="saveRcaUi(${id})">Save Root Cause Analysis</button></div>` : ""}</div>
   <div class="card"><h3>Evidence Repository (Lab 17)</h3>
    ${seeEv ? `<div class="table-wrap"><table class="data"><thead><tr><th>File</th><th>Description</th><th>Size</th><th>Uploaded by</th><th>Date</th></tr></thead><tbody>
    ${ev.length ? ev.map(e => `<tr><td>${fileLink(e)}</td><td>${esc(e.description)}</td><td>${(e.file_size / 1024).toFixed(1)} KB</td><td>${esc(nameOf(getUser(e.uploaded_by), "full_name"))}</td><td>${e.uploaded_at}</td></tr>`).join("") : emptyRow(5, "No evidence uploaded.")}</tbody></table></div>` : `<p class="flash err">Evidence is restricted to authorized users.</p>`}
    ${edit ? `<h4>Upload evidence</h4><div class="row"><div><input id="ev_file" type="file"></div><div style="flex:2"><input id="ev_desc" placeholder="What does this evidence show?"></div><div style="flex:0"><button class="btn primary" onclick="uploadEvidence(${id})">Upload</button></div></div>` : ""}</div>`;
}
const advanceInv = (id, to) => redraw(run(() => updateInvestigationStatus(id, to, currentUser)));
const saveNotesUi = id => { const r = run(() => saveNotes(id, $("inv_notes").value, currentUser)); r.ok ? redraw(r) : say(r); };
function saveFindingsUi(id) {
  const g = k => $("fd_" + k).value.trim(), r = run(() => saveFindings(id, { findings: g("findings"), witnesses: g("witnesses"), recommendation: g("recommendation") }, currentUser)); r.ok ? redraw(r) : say(r);
}
function saveRcaUi(id) {
  const g = k => $("fd_" + k).value.trim(), r = run(() => saveFindings(id, { rca_problem: g("rca_problem"), rca_cause: g("rca_cause"), rca_evidence: g("rca_evidence"), immediate_cause: g("immediate_cause"),
    root_cause: g("root_cause"), contributing_factors: g("contributing_factors"), preventive_measures: g("preventive_measures") }, currentUser)); r.ok ? redraw(r) : say(r);
}
async function uploadEvidence(id) {
  const file = await readFileInput("ev_file"); const r = run(() => addEvidence(id, file, val("ev_desc"), currentUser)); r.ok ? redraw(r) : say(r);
}

/* =================== ACTIONS (Labs 20-23) =================== */
const visibleActions = () => roleName(currentUser) === R.AO ? db.actions.filter(a => a.responsible_id === currentUser.user_id)
  : roleName(currentUser) === R.INV ? db.actions.filter(a => { const v = getInvestigation(a.investigation_id); return v && v.investigator_id === currentUser.user_id; }) : db.actions;
RENDER.actions = () => {
  const eligible = db.incidents.filter(i => { const v = invOfIncident(i.incident_id), f = v && findingsOf(v.investigation_id);
    return v && f && f.root_cause && !["Resolved", "Closed"].includes(i.status) && (roleName(currentUser) !== R.INV || v.investigator_id === currentUser.user_id); });
  const form = can("action_create") ? `<div class="card"><h3>Create Corrective / Preventive Action (Labs 20-21)</h3>
   ${eligible.length ? `<p class="muted">Only incidents whose investigation has findings and a root cause can receive actions.</p><div class="grid">
    ${sel("ac_inc", "Incident *", eligible.map(i => [i.incident_id, i.incident_number + " - " + (getType(i.type_id) || {}).type_name]), "", "-- Select incident --")}
    ${sel("ac_type", "Action Type *", ACTION_TYPES.map(t => [t, t]), "", "-- Select type --")}
    ${sel("ac_who", "Responsible Person *", usersWithRole(R.AO).map(u => [u.user_id, u.full_name]), "", "-- Select person --")}
    ${fld("ac_target", "Target Date *", "", { type: "date" })}${sel("ac_pri", "Priority *", SEVERITIES.map(s => [s, s]), "Medium", "-- Select --")}
    <div><label>Required before resolution?</label><select id="ac_req"><option value="1">Yes (required)</option><option value="0">No (optional)</option></select></div>
    ${area("ac_desc", "Action Requirements *", "", 2)}</div><div class="actions"><button class="btn primary" onclick="doCreateAction()">Save &amp; Notify Responsible Person</button></div>`
    : `<p class="muted">No incident is ready for actions yet. An investigator must record the findings and root cause first.</p>`}</div>` : "";
  const f = ui.actionFilter, all = visibleActions().filter(a => !f || a.status === f);
  const od = overdueActions().filter(x => visibleActions().includes(x.a));
  return form + `<div class="card"><h3>Action Monitoring (Lab 22)</h3><p class="muted">Pending → In Progress → Completed → Verified</p>
   <div style="max-width:240px"><select onchange="ui.actionFilter=this.value;renderPage()">${optionList(ACTION_STATUSES, s => s, s => s, f, "All statuses")}</select></div><br>
   <div class="table-wrap"><table class="data"><thead><tr><th>Incident</th><th>Action</th><th>Responsible</th><th>Deadline</th><th>Completed</th><th>Priority</th><th>Status</th><th>Remarks</th><th></th></tr></thead><tbody>
   ${all.length ? all.map(a => { const nxt = ACTION_STATUSES[ACTION_STATUSES.indexOf(a.status) + 1], mine = a.responsible_id === currentUser.user_id;
     const may = nxt && (nxt === "Verified" ? can("action_verify") : (mine || can("action_verify")));
     return `<tr class="${!isDone(a) && a.target_date < today() ? "row-bad" : ""}"><td>${esc(nameOf(getIncident(a.incident_id), "incident_number"))}</td><td><b>${esc(a.action_type)}</b><br>${esc(a.description)}</td>
     <td>${esc(nameOf(getUser(a.responsible_id), "full_name"))}</td><td>${a.target_date}</td><td>${a.completion_date || "-"}</td><td>${sevBadge(a.priority)}</td>
     <td><span class="badge ${a.status === "Verified" ? "green" : a.status === "Completed" ? "blue" : a.status === "In Progress" ? "orange" : "gray"}">${a.status}</span></td><td>${esc(a.remarks)}</td>
     <td>${may ? `<button class="btn small success" onclick="advanceAction(${a.action_id},'${nxt}')">→ ${nxt}</button>` : ""}<button class="btn small" onclick="showActionHistory(${a.action_id})">History</button></td></tr>`; }).join("") : emptyRow(9, "No actions found.")}</tbody></table></div>
   <div id="actHistory"></div></div>
   <div class="card"><h3>Overdue Actions (Lab 23)</h3><p class="muted">Rule: Current Date &gt; Target Date AND Status ≠ Completed</p><div class="table-wrap"><table class="data"><thead><tr><th>Incident No.</th><th>Action</th><th>Responsible</th><th>Due Date</th><th class="num">Overdue Days</th></tr></thead><tbody>
   ${od.length ? od.map(x => `<tr class="row-bad"><td>${esc(getIncident(x.a.incident_id).incident_number)}</td><td>${esc(x.a.action_type)}: ${esc(x.a.description)}</td><td>${esc(getUser(x.a.responsible_id).full_name)}</td><td>${x.a.target_date}</td><td class="num"><b>${x.days}</b></td></tr>`).join("") : emptyRow(5, "🎉 No overdue actions.")}</tbody></table></div></div>`;
};
function doCreateAction() {
  const r = run(() => createAction({ incident_id: val("ac_inc"), action_type: val("ac_type"), description: $("ac_desc").value, responsible_id: val("ac_who"), target_date: val("ac_target"), priority: val("ac_pri"), is_required: val("ac_req") === "1" }, currentUser));
  r.ok ? redraw(r) : say(r);
}
function advanceAction(id, to) {
  let remarks = ""; if (to === "Completed") { remarks = prompt("What was done? (required)"); if (remarks === null) return; remarks = remarks.trim(); }
  else if (to === "Verified") { remarks = prompt("Verification remarks (optional):") || ""; }
  const r = run(() => updateActionStatus(id, to, remarks, currentUser)); r.ok ? redraw(r) : say(r);
}
function showActionHistory(id) {
  const h = db.monitoring.filter(m => m.action_id === id);
  $("actHistory").innerHTML = `<h4>Status history</h4><table class="data"><thead><tr><th>Date</th><th>From</th><th>To</th><th>By</th><th>Remarks</th></tr></thead><tbody>${h.map(m => `<tr><td>${m.changed_at}</td><td>${esc(m.old_status) || "-"}</td><td>${esc(m.new_status)}</td><td>${esc(nameOf(getUser(m.changed_by), "full_name"))}</td><td>${esc(m.remarks)}</td></tr>`).join("")}</tbody></table>`;
}

/* =================== RESOLUTIONS & CLOSURE (Labs 24-26) =================== */
RENDER.resolutions = () => {
  if (ui.closeIncident) return closurePanel(ui.closeIncident);
  const pending = db.incidents.filter(i => !["Resolved", "Closed"].includes(i.status) && invOfIncident(i.incident_id));
  const resolved = db.incidents.filter(i => i.status === "Resolved");
  const form = can("resolution_record") ? `<div class="card"><h3>Record Resolution (Labs 24-25)</h3><div class="grid">
    ${sel("rs_inc", "Incident *", pending.map(i => [i.incident_id, i.incident_number + " - " + i.status]), "", "-- Select incident --", "resCheck()")}
    ${sel("rs_type", "Resolution Type *", RESOLUTION_TYPES.map(t => [t, t]), "", "-- Select type --")}${fld("rs_date", "Resolution Date *", today(), { type: "date" })}
    ${fld("rs_doc", "Supporting Document (file name)", "", { ph: "e.g. inspection-report.pdf" })}${area("rs_desc", "Resolution Description *", "", 2)}${area("rs_rem", "Remarks", "", 1)}</div>
    <div id="resReady" class="card" style="margin-top:12px;background:#f9fafb"><span class="muted">Select an incident to review its investigation findings, corrective actions and the resolution rules.</span></div>
    <div class="actions"><button class="btn primary" onclick="doResolve()">Record Resolution</button></div></div>` : "";
  return form + `<div class="card"><h3>Ready for Closure (Lab 26)</h3><div class="table-wrap"><table class="data"><thead><tr><th>Incident</th><th>Severity</th><th>Resolved</th><th>Resolution</th><th></th></tr></thead><tbody>
   ${resolved.length ? resolved.map(i => { const r = resolutionOf(i.incident_id); return `<tr><td><b>${esc(i.incident_number)}</b></td><td>${sevBadge(i.severity)}</td><td>${r.resolution_date}</td><td>${esc(r.resolution_type)}</td>
    <td>${can("incident_close") ? `<button class="btn small success" onclick="ui.closeIncident=${i.incident_id};renderPage()">Review &amp; Close</button>` : `<span class="muted">Supervisor must close</span>`}</td></tr>`; }).join("") : emptyRow(5, "No resolved incidents waiting for closure.")}</tbody></table></div></div>
   <div class="card"><h3>All Resolutions</h3><div class="table-wrap"><table class="data"><thead><tr><th>Incident</th><th>Type</th><th>Date</th><th>By</th><th>Status now</th><th>Description</th></tr></thead><tbody>
   ${db.resolutions.length ? db.resolutions.map(r => `<tr><td>${esc(nameOf(getIncident(r.incident_id), "incident_number"))}</td><td>${esc(r.resolution_type)}</td><td>${r.resolution_date}</td><td>${esc(nameOf(getUser(r.resolved_by), "full_name"))}</td><td>${statusBadge(getIncident(r.incident_id).status)}</td><td>${esc(r.description)}</td></tr>`).join("") : emptyRow(6, "No resolutions yet.")}</tbody></table></div></div>`;
};
function reviewHtml(incId) {                    // shared summary: findings + actions + rules
  const inc = getIncident(incId), inv = invOfIncident(incId), f = inv && findingsOf(inv.investigation_id), acts = actionsOfIncident(incId), problems = checkResolutionRules(incId);
  return `<p><b>${esc(inc.incident_number)}</b> · ${statusBadge(inc.status)} · ${esc(nameOf(getType(inc.type_id), "type_name"))} at ${esc(locName(getLocation(inc.location_id)))}</p>
   <p><b>Investigation:</b> ${inv ? esc(inv.status) : "none"}<br><b>Findings:</b> ${f ? pre(f.findings) : "-"}<br><b>Root cause:</b> ${f ? pre(f.root_cause) : "-"}</p>
   <p><b>Actions:</b></p><ul>${acts.map(a => `<li>${esc(a.action_type)} – ${esc(a.description)} <b>[${a.status}]</b>${a.is_required ? "" : " (optional)"}</li>`).join("") || "<li class='muted'>none</li>"}</ul>
   ${problems.length ? `<div class="flash err">Not ready: ${problems.map(esc).join(" ")}</div>` : `<div class="flash ok">✔ All resolution rules are satisfied.</div>`}`;
}
function resCheck() { const id = val("rs_inc"); $("resReady").innerHTML = id ? reviewHtml(id) : `<span class="muted">Select an incident.</span>`; }
function doResolve() {
  const r = run(() => recordResolution({ incident_id: val("rs_inc"), resolution_type: val("rs_type"), description: $("rs_desc").value, resolution_date: val("rs_date"), remarks: $("rs_rem").value.trim(), supporting_document: val("rs_doc") }, currentUser));
  r.ok ? redraw(r) : say(r);
}
function closurePanel(id) {
  const inc = getIncident(id), res = resolutionOf(id);
  return `<div class="actions" style="margin:0 0 14px"><button class="btn" onclick="ui.closeIncident=null;renderPage()">← Back</button></div>
   <div class="card"><h3>Incident Closure Review (Lab 26)</h3>${reviewHtml(id)}
   <p><b>Resolution:</b> ${res ? esc(res.resolution_type) + " on " + res.resolution_date + " – " + esc(res.description) : "none"}</p>
   <label style="font-weight:normal"><input type="checkbox" id="cl_confirm"> I reviewed the incident details, investigation findings, actions and resolution, and I confirm the resolution.</label>
   <label>Closure remarks</label><input id="cl_rem"><div class="actions"><button class="btn success" onclick="doClose(${id})">Close Incident</button></div></div>`;
}
function doClose(id) {
  const r = run(() => closeIncident(id, $("cl_confirm").checked, val("cl_rem"), currentUser)); if (r.ok) { ui.closeIncident = null; redraw(r); } else say(r);
}

/* =================== WORKFLOW INTEGRATION (Labs 27-33) =================== */
RENDER.integration = () => {
  const ids = db.incidents.map(i => i.incident_id); if (!ui.traceId || !getIncident(ui.traceId)) ui.traceId = (db.incidents.find(i => i.status === "Closed") || db.incidents[0] || {}).incident_id;
  const labs = [27, 28, 29, 30, 31, 32];
  return `<div class="card"><h3>Labs 27-32: Integration Checks</h3><p class="muted">Each check tests the whole database: reporter → incident → location → investigation → action → resolution → closure.</p>
   <div class="table-wrap"><table class="data"><thead><tr><th>Lab</th><th>Integration</th><th>Rule verified</th><th class="num">Records checked</th><th>Result</th></tr></thead><tbody>
   ${labs.map(l => { const c = INTEGRATION_CHECKS[l](); return `<tr class="${c.problems.length ? "row-bad" : ""}"><td>${l}</td><td>${esc(c.name)}</td><td>${esc(c.rule)}</td><td class="num">${c.checked}</td>
     <td>${c.problems.length ? `<span class="badge red">FAIL</span><br>${c.problems.map(esc).join("<br>")}` : `<span class="badge green">PASS</span>`}</td></tr>`; }).join("")}
   ${(() => { const c = checkRelationships(); return `<tr><td>3</td><td>${c.name}</td><td>${c.rule}</td><td class="num">${c.checked}</td><td>${c.problems.length ? `<span class="badge red">FAIL</span>` : `<span class="badge green">PASS</span>`}</td></tr>`; })()}
   </tbody></table></div></div>
   <div class="card"><h3>Lab 33: Complete End-to-End Incident Workflow</h3>
   <p class="muted">Choose an incident to see its complete, traceable record. Closed incidents show every step done.</p>
   <div style="max-width:420px"><select onchange="ui.traceId=this.value;renderPage()">${optionList(db.incidents, i => i.incident_id, i => i.incident_number + " - " + i.status, ui.traceId)}</select></div><br>
   ${ui.traceId ? timelineHtml(ui.traceId) : ""}
   <p class="muted">Tip: to run the whole workflow automatically, open <a href="#" onclick="go('testing');return false">Testing</a> and press "Run End-to-End Test" (Lab 51).</p></div>`;
};

/* =================== REPORTS (Labs 38-44) =================== */
const REPORT_TYPES = [["summary", "Lab 38 - Incident Summary"], ["category", "Lab 39 - Incident Category"], ["location", "Lab 40 - Incident Location"], ["investigation", "Lab 41 - Investigation"],
  ["action", "Lab 42 - Corrective Action"], ["resolution", "Lab 43 - Incident Resolution"], ["trend", "Lab 44 - Incident Trend Analysis"]];
RENDER.reports = () => `<div class="card no-print"><div class="row">
  <div style="flex:2"><label>Report</label><select id="rp_type" onchange="rpChange()">${optionList(REPORT_TYPES, t => t[0], t => t[1], ui.reportType)}</select></div>
  <div><label>Incident date from</label><input id="rp_from" type="date" value="${esc(ui.rf.from)}" onchange="rpChange()"></div>
  <div><label>Incident date to</label><input id="rp_to" type="date" value="${esc(ui.rf.to)}" onchange="rpChange()"></div></div>
  <div class="actions"><button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button><button class="btn" onclick="exportReportCsv()">📊 Export CSV (Excel)</button></div></div>
  <div class="card" id="rp_out">${reportHtml()}</div>`;
function reportHtml() {
  const r = buildReport(ui.reportType, ui.rf);
  return `<h2>${r.title}</h2><p class="muted">Generated ${today()} by ${esc(currentUser.full_name)}${ui.rf.from || ui.rf.to ? " · incidents from " + (ui.rf.from || "start") + " to " + (ui.rf.to || "today") : ""}</p>` +
    r.sections.map(s => `<h4>${esc(s.name)}</h4><div class="table-wrap"><table class="data"><thead><tr>${s.headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
    ${s.rows.length ? s.rows.map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") : emptyRow(s.headers.length, "No data for this period.")}</tbody></table></div>`).join("");
}
function rpChange() { ui.reportType = val("rp_type"); ui.rf = { from: val("rp_from"), to: val("rp_to") }; $("rp_out").innerHTML = reportHtml(); }
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportReportCsv() {
  const r = buildReport(ui.reportType, ui.rf), q = c => '"' + String(c).replace(/"/g, '""') + '"';
  const text = r.sections.map(s => [q(s.name), s.headers.map(q).join(",")].concat(s.rows.map(row => row.map(q).join(","))).join("\r\n")).join("\r\n\r\n");
  download(ui.reportType + "_report_" + today() + ".csv", text, "text/csv");
}
