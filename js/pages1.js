"use strict";
/* =====================================================================
   pages1.js - APP SHELL, LOGIN, DASHBOARD, INCIDENTS, REPORTERS,
               CLASSIFICATION, LOCATIONS   (Labs 1, 4-13, 34, 45)
   ===================================================================== */
const ALLR = Object.values(R);
const ui = { page: "dashboard", pg: {}, viewIncident: null, editIncident: null, showIncForm: false, viewReporter: null, editReporter: null, editLocation: null,
  viewInv: null, assignIncident: "", f: { q: "", from: "", to: "", sev: "", status: "", cat: "", loc: "" }, rf: { from: "", to: "" }, reportType: "summary",
  actionFilter: "", closeIncident: null, auditFilter: "" };
const RENDER = {};
const PAGES = [
  { id: "dashboard", from: 45, label: "Dashboard", labs: "Lab 45", icon: "📊", roles: [R.ADMIN, R.IO, R.SUP, R.MGT] },
  { group: "Incident Workflow" },
  { id: "incidents", from: 8, label: "Incidents", labs: "Labs 8-10, 12", icon: "🚨", roles: [R.ADMIN, R.REP, R.IO, R.INV, R.AO, R.SUP] },
  { id: "reporters", from: 4, label: "Reporters", labs: "Labs 4-6", icon: "🧑", roles: [R.ADMIN, R.REP, R.IO] },
  { id: "classification", from: 7, label: "Categories & Types", labs: "Lab 7", icon: "🗂️", roles: [R.ADMIN, R.IO] },
  { id: "locations", from: 11, label: "Locations", labs: "Labs 11-13", icon: "📍", roles: [R.ADMIN, R.IO, R.SUP] },
  { id: "investigations", from: 14, label: "Investigations", labs: "Labs 14-19", icon: "🔍", roles: [R.ADMIN, R.IO, R.INV, R.SUP] },
  { id: "actions", from: 20, label: "Corrective Actions", labs: "Labs 20-23", icon: "🛠️", roles: [R.ADMIN, R.IO, R.INV, R.AO, R.SUP] },
  { id: "resolutions", from: 24, label: "Resolution & Closure", labs: "Labs 24-26", icon: "✅", roles: [R.ADMIN, R.IO, R.SUP] },
  { id: "integration", from: 27, label: "Workflow Integration", labs: "Labs 27-33", icon: "🔗", roles: [R.ADMIN, R.IO, R.SUP] },
  { id: "reports", from: 38, label: "Reports", labs: "Labs 38-44", icon: "📑", roles: [R.ADMIN, R.IO, R.SUP, R.MGT] },
  { group: "My Account" },
  { id: "notifications", from: 15, label: "Notifications", labs: "Labs 15, 21", icon: "🔔", roles: ALLR },
  { id: "account", from: 1, label: "My Account", labs: "Lab 34", icon: "👤", roles: ALLR },
  { group: "Administration" },
  { id: "users", from: 34, label: "Users & Roles", labs: "Labs 34-36", icon: "👥", roles: [R.ADMIN] },
  { id: "audit", from: 37, label: "Audit Trail", labs: "Lab 37", icon: "📜", roles: [R.ADMIN, R.SUP] },
  { id: "setup", from: 1, label: "Project Setup", labs: "Lab 1", icon: "🧰", roles: [R.ADMIN] },
  { id: "design", from: 2, label: "Database Design", labs: "Labs 2-3", icon: "🗄️", roles: [R.ADMIN] },
  { group: "Quality & Release" },
  { id: "testing", from: 46, label: "Testing", labs: "Labs 46-51, 55-56", icon: "🧪", roles: [R.ADMIN] },
  { id: "uat", from: 52, label: "User Acceptance", labs: "Lab 52", icon: "🙋", roles: [R.ADMIN] },
  { id: "bugs", from: 53, label: "Bug Tracking", labs: "Lab 53", icon: "🐞", roles: [R.ADMIN] },
  { id: "backup", from: 54, label: "Backup & Deployment", labs: "Labs 54, 57-59", icon: "💾", roles: [R.ADMIN] },
  { group: "Documentation" },
  { id: "manual", from: 60, label: "User Manual", labs: "Lab 60", icon: "📖", roles: ALLR },
  { id: "techdocs", from: 61, label: "Technical Docs", labs: "Lab 61", icon: "📚", roles: [R.ADMIN] },
  { id: "final", from: 62, label: "Refinement & Demo", labs: "Labs 62-63", icon: "🎬", roles: [R.ADMIN] },
  { id: "labmap", from: 1, label: "Lab Map (1-63)", labs: "All labs", icon: "🗺️", roles: ALLR }
];
const pageDef = id => PAGES.find(p => p.id === id);
const unlocked = id => (pageDef(id).from || 1) <= UNLOCKED_LAB;          // is the lab for this page unlocked yet?
const roleOk = id => { const d = pageDef(id); return !!d && !!currentUser && d.roles.includes(roleName(currentUser)); };
const allowed = id => roleOk(id) && unlocked(id);
const firstPage = () => (PAGES.find(p => p.id && allowed(p.id)) || { id: "labmap" }).id;

/* ---------- navigation & drawing ---------- */
function buildNav() {
  let html = `<div class="unlock-note">🔓 Unlocked: Labs 1-${UNLOCKED_LAB} of ${TOTAL_LABS}</div>`, pending = "";
  PAGES.forEach(p => {
    if (p.group) { pending = `<div class="nav-group">${p.group}</div>`; return; }
    if (!allowed(p.id)) return;
    html += pending; pending = "";
    html += `<a href="#" class="${ui.page === p.id ? "active" : ""}" onclick="nav('${p.id}');return false">${p.icon} ${p.label}<small>${p.labs}</small></a>`;
  });
  $("nav").innerHTML = html;
}
function nav(page) {                              // menu clicks start from the list view of a page
  ui.viewIncident = null; ui.viewReporter = null; ui.viewInv = null; ui.closeIncident = null; go(page);
}
function go(page) {
  if (!allowed(page)) {
    flash = fail(roleOk(page) && !unlocked(page) ? "This page belongs to Lab " + pageDef(page).from + " and is not unlocked yet (Labs 1-" + UNLOCKED_LAB + " are unlocked)."
      : "Access denied. Your role (" + roleName(currentUser) + ") cannot open that page.");
    page = firstPage();
  }
  ui.page = page; $("sidebar").classList.remove("open"); renderPage();
}
function renderPage() {
  buildNav();
  const def = pageDef(ui.page);
  $("pageTitle").textContent = def.icon + " " + def.label + "  (" + def.labs + ")";
  const n = unreadCount(); $("bellCount").textContent = n; $("bellCount").classList.toggle("hidden", n === 0);
  let html;
  try { html = RENDER[ui.page](); } catch (e) { html = `<div class="flash err">Something went wrong while drawing this page: ${esc(e.message)}</div>`; }
  $("page").innerHTML = `<div id="flash" class="flash hidden"></div>` + html;
  if (flash) { say(flash); flash = null; }
  window.scrollTo(0, 0);
}
function say(r) {
  const el = $("flash"); if (!el) return;
  el.className = "flash " + (r.ok ? "ok" : "err"); el.textContent = (r.ok ? "✔ " : "✖ ") + r.msg; el.scrollIntoView({ block: "nearest" });
}
function redraw(r) { flash = r || null; renderPage(); }

/* ---------- small UI builders ---------- */
const optionList = (items, vf, tf, selected, first) => (first !== undefined ? `<option value="">${esc(first)}</option>` : "") +
  items.map(i => `<option value="${esc(vf(i))}" ${String(vf(i)) === String(selected) ? "selected" : ""}>${esc(tf(i))}</option>`).join("");
const fld = (id, label, value, o) => { o = o || {}; return `<div><label>${label}</label><input id="${id}" type="${o.type || "text"}" value="${esc(value)}" placeholder="${esc(o.ph || "")}" ${o.attrs || ""}></div>`; };
const sel = (id, label, items, selected, first, onchange) => `<div><label>${label}</label><select id="${id}" ${onchange ? `onchange="${onchange}"` : ""}>${optionList(items, i => i[0], i => i[1], selected, first)}</select></div>`;
const area = (id, label, value, rows) => `<div style="grid-column:1/-1"><label>${label}</label><textarea id="${id}" rows="${rows || 2}">${esc(value)}</textarea></div>`;
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="muted" style="text-align:center;padding:18px">${text}</td></tr>`;
const statusBadge = s => `<span class="badge ${{ "Open": "blue", "Under Investigation": "orange", "For Action": "purple", "Resolved": "green", "Closed": "gray" }[s] || "gray"}">${esc(s)}</span>`;
const sevBadge = s => `<span class="badge ${{ Low: "gray", Medium: "blue", High: "orange", Critical: "red" }[s] || "gray"}">${esc(s)}</span>`;
const activeBadge = s => `<span class="badge ${s === "Active" ? "green" : "gray"}">${esc(s)}</span>`;
const pre = t => `<span style="white-space:pre-wrap">${esc(t) || "-"}</span>`;
const deptItems = () => db.departments.filter(isActive).map(d => [d.department_id, d.department_name]);
function barChart(title, data) {
  const max = Math.max(1, ...data.map(d => d.value));
  return `<div class="card"><h3>${title}</h3>` + (data.length ? data.map(d => `<div class="bar-row"><span class="bar-label" title="${esc(d.label)}">${esc(d.label)}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${(d.value / max * 100).toFixed(1)}%"></div></div><span class="bar-val">${d.value}</span></div>`).join("") : `<p class="muted">No data yet.</p>`) + `</div>`;
}
const PAGE_SIZE = 10;
function paginate(list, key, refreshFn) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE)); const p = Math.min(ui.pg[key] || 1, pages); ui.pg[key] = p;
  const html = `<div class="pager"><span>${list.length} record(s) · page ${p} of ${pages}</span>
    <button class="btn small" ${p <= 1 ? "disabled" : ""} onclick="setPage('${key}',${p - 1},'${refreshFn}')">◀ Prev</button>
    <button class="btn small" ${p >= pages ? "disabled" : ""} onclick="setPage('${key}',${p + 1},'${refreshFn}')">Next ▶</button></div>`;
  return { rows: list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), html };
}
function setPage(key, n, fn) { ui.pg[key] = n; window[fn](); }
function readFileInput(id) {                       // reads a chosen file into text (data URL) for browser storage
  return new Promise(resolve => {
    const f = $(id) && $(id).files[0]; if (!f) return resolve(null);
    const meta = { name: f.name, size: f.size, data: "" };
    if (validateFile(meta)) return resolve(meta);
    const r = new FileReader(); r.onload = () => { meta.data = r.result; resolve(meta); }; r.onerror = () => resolve(meta); r.readAsDataURL(f);
  });
}
const fileLink = (rec) => rec.data ? `<a href="${rec.data}" download="${esc(rec.file_name)}">${esc(rec.file_name)}</a>` : esc(rec.file_name) + ` <span class="muted">(sample, no file data)</span>`;

/* ---------- login, logout, sessions (Lab 34) ---------- */
let lastActive = Date.now();
function showForgot(on) { $("loginForm").classList.toggle("hidden", on); $("forgotForm").classList.toggle("hidden", !on); $("loginError").classList.add("hidden"); }
function loginMsg(text, good) { const b = $("loginError"); b.textContent = text; b.className = "flash " + (good ? "ok" : "err"); }
function startSession(u) {
  Object.assign(ui, { viewIncident: null, editIncident: null, showIncForm: false, viewReporter: null, editReporter: null, editLocation: null, viewInv: null, closeIncident: null, assignIncident: "", actionFilter: "", pg: {},
    f: { q: "", from: "", to: "", sev: "", status: "", cat: "", loc: "" } });     // a new user always starts from a clean screen
  currentUser = u; sessionStorage.setItem("irs_session", u.user_id); lastActive = Date.now();
  $("loginScreen").classList.add("hidden"); $("app").classList.remove("hidden");
  $("userInfo").textContent = u.full_name + " (" + roleName(u) + ")";
}
function doLogin() {
  const name = $("login_user").value.trim(), u = authenticate(name, $("login_pass").value);
  if (!u) {
    const res = run(() => { audit(null, "Failed login attempt for '" + name.slice(0, 30) + "'", null, "", "", "Login"); save(); return ok(""); });
    return loginMsg(res.ok ? "Invalid username or password." : res.msg, false);
  }
  const res = run(() => { audit(u, "Logged in", null, "", "", "Login"); save(); return ok(""); });
  if (!res.ok) return loginMsg(res.msg, false);
  $("loginError").classList.add("hidden"); $("login_pass").value = ""; startSession(u);
  if (u.must_change) { flash = ok("You are using a temporary password. Please change it now."); ui.page = "account"; renderPage(); }
  else { ui.page = firstPage(); renderPage(); }
}
function doForgot() {
  const u = db.users.find(x => x.username.toLowerCase() === val("fp_user").toLowerCase());
  if (!u || u.status !== "Active" || !u.email || u.email.toLowerCase() !== val("fp_email").toLowerCase()) return loginMsg("Username and email do not match an active account.", false);
  const temp = "Temp" + Math.floor(100000 + Math.random() * 900000);
  u.password_hash = hashPw(temp); u.must_change = true; audit(u, "Password reset requested", null, "", "", "Update");
  const res = run(() => { save(); return ok(""); }); if (!res.ok) return loginMsg(res.msg, false);
  loginMsg("Your temporary password is: " + temp + "  (login, then change it)", true); showForgot(false);
}
function logout(reason) {
  if (currentUser) run(() => { audit(currentUser, reason || "Logged out", null, "", "", "Login"); save(); return ok(""); });
  currentUser = null; sessionStorage.removeItem("irs_session");
  $("app").classList.add("hidden"); $("loginScreen").classList.remove("hidden");
  $("login_user").value = ""; $("login_pass").value = "";
  if (reason) loginMsg(reason + ". Please login again.", false);
}
function sessionTick() {                            // automatic logout when idle
  if (currentUser && Date.now() - lastActive > SESSION_MINUTES * 60000) logout("Session expired after " + SESSION_MINUTES + " minutes of inactivity");
}

/* =================== DASHBOARD (Lab 45) =================== */
RENDER.dashboard = () => {
  const incs = db.incidents, c = s => incs.filter(i => i.status === s).length;
  const pendingActs = db.actions.filter(a => !isDone(a)).length;
  const overdue = overdueActions().length + db.investigations.filter(invOverdue).length;
  const cnt = (list, fn) => { const m = countBy(list, fn); return Object.keys(m).sort((a, b) => m[b] - m[a]).map(k => ({ label: k, value: m[k] })); };
  const months = [...new Set(incs.map(i => monthOf(i.incident_date)))].sort().map(m => ({ label: m, value: incs.filter(i => monthOf(i.incident_date) === m).length }));
  const resolvedN = incs.filter(i => resolutionOf(i.incident_id)).length;
  return `${overdue ? `<div class="alert-box">⚠️ <b>${overdue}</b> overdue item(s) (actions and investigations past their deadline). ${can("action_update") ? `<a href="#" onclick="go('actions');return false">View actions →</a>` : ""}</div>` : ""}
  <div class="stat-grid">
    <div class="stat"><div class="n">${incs.length}</div><div class="t">Total Incidents</div></div>
    <div class="stat orange"><div class="n">${c("Open")}</div><div class="t">Open Incidents</div></div>
    <div class="stat orange"><div class="n">${c("Under Investigation")}</div><div class="t">Under Investigation</div></div>
    <div class="stat purple"><div class="n">${pendingActs}</div><div class="t">Pending Actions</div></div>
    <div class="stat green"><div class="n">${c("Resolved")}</div><div class="t">Resolved</div></div>
    <div class="stat green"><div class="n">${c("Closed")}</div><div class="t">Closed</div></div>
    <div class="stat red"><div class="n">${overdue}</div><div class="t">Overdue</div></div>
  </div>
  <div class="chart-grid">
    ${barChart("Incidents by Category", cnt(incs, i => (getCategory(i.category_id) || {}).category_name))}
    ${barChart("Incidents by Type", cnt(incs, i => (getType(i.type_id) || {}).type_name).slice(0, 8))}
    ${barChart("Incidents by Location", cnt(incs, i => locName(getLocation(i.location_id))))}
    ${barChart("Incidents by Severity", SEVERITIES.map(s => ({ label: s, value: incs.filter(i => i.severity === s).length })))}
    ${barChart("Monthly Incident Trend", months)}
    ${barChart("Investigation Status", INV_STATUSES.map(s => ({ label: s, value: db.investigations.filter(v => v.status === s).length })))}
    ${barChart("Resolution Status", [{ label: "Resolved/Closed", value: resolvedN }, { label: "Not yet resolved", value: incs.length - resolvedN }])}
  </div>`;
};

/* =================== INCIDENTS (Labs 8-10, 12) =================== */
function visibleIncidents() {
  const r = roleName(currentUser), all = db.incidents;
  if (r === R.REP) return all.filter(i => i.reporter_id === currentUser.reporter_id);
  if (r === R.INV) return all.filter(i => { const v = invOfIncident(i.incident_id); return v && v.investigator_id === currentUser.user_id; });
  if (r === R.AO) return all.filter(i => actionsOfIncident(i.incident_id).some(a => a.responsible_id === currentUser.user_id));
  return all;
}
const canSeeIncident = id => visibleIncidents().some(i => i.incident_id == id);
RENDER.incidents = () => {
  if (ui.viewIncident) return canSeeIncident(ui.viewIncident) ? incidentDetail(ui.viewIncident) : `<div class="flash err">You are not allowed to view this incident.</div>`;
  const edit = ui.editIncident ? getIncident(ui.editIncident) : null, f = ui.f;
  const form = (can("incident_create") && (ui.showIncForm || edit)) ? incidentForm(edit) :
    (can("incident_create") ? `<div class="actions" style="margin:0 0 14px"><button class="btn primary" onclick="ui.showIncForm=true;renderPage()">➕ Report New Incident</button></div>` : "");
  const isRep = roleName(currentUser) === R.REP;
  return form + `<div class="card"><h3>${isRep ? "My Incidents" : "Incident Monitoring"}</h3><div class="row">
    <div style="flex:2"><label>Search (number, reporter, type, category, location)</label><input id="f_q" value="${esc(f.q)}" oninput="incFilter()" placeholder="🔍 e.g. IN-2026-0001"></div>
    <div><label>Date from</label><input id="f_from" type="date" value="${esc(f.from)}" onchange="incFilter()"></div>
    <div><label>Date to</label><input id="f_to" type="date" value="${esc(f.to)}" onchange="incFilter()"></div></div>
    <div class="row">
    <div><label>Severity</label><select id="f_sev" onchange="incFilter()">${optionList(SEVERITIES, s => s, s => s, f.sev, "All")}</select></div>
    <div><label>Status</label><select id="f_status" onchange="incFilter()">${optionList(INC_STATUSES, s => s, s => s, f.status, "All")}</select></div>
    <div><label>Category</label><select id="f_cat" onchange="incFilter()">${optionList(db.categories, c => c.category_id, c => c.category_name, f.cat, "All")}</select></div>
    <div><label>Location</label><select id="f_loc" onchange="incFilter()">${optionList(db.locations, l => l.location_id, l => locName(l), f.loc, "All")}</select></div></div>
    <div id="incList">${incidentListHtml()}</div></div>`;
};
function incidentListHtml() {
  const f = ui.f, q = f.q.toLowerCase();
  const list = visibleIncidents().filter(i => {
    const rep = getReporter(i.reporter_id), txt = (i.incident_number + " " + (rep || {}).full_name + " " + (getType(i.type_id) || {}).type_name + " " + (getCategory(i.category_id) || {}).category_name + " " + locName(getLocation(i.location_id))).toLowerCase();
    return (!q || txt.includes(q)) && inRange(i.incident_date, f) && (!f.sev || i.severity === f.sev) && (!f.status || i.status === f.status) &&
      (!f.cat || i.category_id == f.cat) && (!f.loc || i.location_id == f.loc);
  }).sort((a, b) => a.incident_date < b.incident_date ? 1 : a.incident_date > b.incident_date ? -1 : b.incident_id - a.incident_id);
  const p = paginate(list, "inc", "refreshIncList");
  return `<div class="table-wrap"><table class="data"><thead><tr><th>Incident No.</th><th>Date</th><th>Reporter</th><th>Category / Type</th><th>Location</th><th>Severity</th><th>Status</th><th></th></tr></thead><tbody>
    ${p.rows.length ? p.rows.map(i => `<tr><td><b>${esc(i.incident_number)}</b></td><td>${i.incident_date}</td><td>${esc(nameOf(getReporter(i.reporter_id), "full_name"))}</td>
      <td>${esc(nameOf(getCategory(i.category_id), "category_name"))} / ${esc(nameOf(getType(i.type_id), "type_name"))}</td><td>${esc(locName(getLocation(i.location_id)))}</td>
      <td>${sevBadge(i.severity)}</td><td>${statusBadge(i.status)}</td><td><button class="btn small" onclick="openIncident(${i.incident_id})">View</button></td></tr>`).join("") : emptyRow(8, "No incidents found.")}</tbody></table></div>${p.html}`;
}
function incFilter() { ui.f = { q: val("f_q"), from: val("f_from"), to: val("f_to"), sev: val("f_sev"), status: val("f_status"), cat: val("f_cat"), loc: val("f_loc") }; ui.pg.inc = 1; refreshIncList(); }
function refreshIncList() { $("incList").innerHTML = incidentListHtml(); }
function openIncident(id) { ui.page = "incidents"; ui.viewIncident = id; ui.editIncident = null; renderPage(); }
function incidentForm(edit) {
  const e = edit || { reporter_id: "", category_id: "", type_id: "", location_id: "", incident_date: "", incident_time: "", description: "", severity: "", immediate_response: "", incident_number: "" };
  const isRep = roleName(currentUser) === R.REP;
  const types = db.types.filter(t => t.category_id == e.category_id && (isActive(t) || t.type_id == e.type_id));
  return `<div class="card"><h3>${edit ? "Edit Incident " + esc(edit.incident_number) : "Report New Incident"}</h3>
   <form novalidate onsubmit="submitIncident(event)"><div class="grid">
    <div><label>Incident Number</label><input value="${edit ? esc(edit.incident_number) : "(generated when saved: " + genIncidentNumber() + ")"}" disabled></div>
    ${isRep ? `<div><label>Reporter</label><input value="${esc(nameOf(getReporter(currentUser.reporter_id), "full_name"))}" disabled></div>` :
      sel("if_rep", "Reporter *", db.reporters.filter(r => isActive(r) || r.reporter_id == e.reporter_id).map(r => [r.reporter_id, r.id_number + " - " + r.full_name]), e.reporter_id, "-- Select reporter --")}
    ${sel("if_cat", "Incident Category *", db.categories.filter(isActive).map(c => [c.category_id, c.category_name]), e.category_id, "-- Select category --", "incCatChange()")}
    <div><label>Incident Type *</label><select id="if_type">${optionList(types, t => t.type_id, t => t.type_name, e.type_id, "-- Select type --")}</select></div>
    ${sel("if_loc", "Location *", db.locations.filter(l => isActive(l) || l.location_id == e.location_id).map(l => [l.location_id, locName(l)]), e.location_id, "-- Select location --")}
    ${fld("if_date", "Date of Incident *", e.incident_date, { type: "date" })}
    ${fld("if_time", "Time of Incident *", e.incident_time, { type: "time" })}
    ${sel("if_sev", "Severity *", SEVERITIES.map(s => [s, s]), e.severity, "-- Select severity --")}
    ${area("if_desc", "Description *", e.description, 3)}
    ${area("if_resp", "Immediate Response", e.immediate_response, 2)}
    ${edit ? "" : `<div><label>Attachment (optional: JPG, PNG, PDF, DOC, TXT up to 300 KB)</label><input id="if_file" type="file"></div>`}
   </div>
   <div class="actions"><button class="btn primary" type="submit">${edit ? "Update Incident" : "Save Incident"}</button>
   <button class="btn" type="button" onclick="ui.showIncForm=false;ui.editIncident=null;renderPage()">Cancel</button></div></form></div>`;
}
function incCatChange() {
  const c = val("if_cat"); $("if_type").innerHTML = optionList(db.types.filter(t => t.category_id == c && isActive(t)), t => t.type_id, t => t.type_name, "", "-- Select type --");
}
async function submitIncident(ev) {
  ev.preventDefault();
  const d = { reporter_id: roleName(currentUser) === R.REP ? currentUser.reporter_id : val("if_rep"), category_id: val("if_cat"), type_id: val("if_type"), location_id: val("if_loc"),
    incident_date: val("if_date"), incident_time: val("if_time"), severity: val("if_sev"), description: $("if_desc").value, immediate_response: $("if_resp").value.trim() };
  if (ui.editIncident) {
    const r = run(() => updateIncident(ui.editIncident, d, currentUser)); if (r.ok) { ui.editIncident = null; redraw(r); } else say(r); return;
  }
  const file = await readFileInput("if_file");
  if (file) { const fe = validateFile(file); if (fe) return say(fail(fe)); }
  const r = run(() => createIncident(d, currentUser));
  if (!r.ok) return say(r);
  let msg = r.msg;
  if (file) { const ar = run(() => addAttachment(r.data.incident_id, file, currentUser)); if (!ar.ok) msg += " (Attachment problem: " + ar.msg + ")"; }
  ui.showIncForm = false; redraw(ok(msg));
}
async function uploadAttachment(incId) {
  const file = await readFileInput("att_file"); const r = run(() => addAttachment(incId, file, currentUser)); r.ok ? redraw(r) : say(r);
}
function incidentDetail(id) {
  const inc = getIncident(id), rep = getReporter(inc.reporter_id), loc = getLocation(inc.location_id), inv = invOfIncident(id), res = resolutionOf(id), acts = actionsOfIncident(id);
  const f = inv && findingsOf(inv.investigation_id), atts = db.attachments.filter(a => a.incident_id === id);
  const editable = (can("incident_edit") && inc.status !== "Closed") || can("incident_edit_closed");
  const flow = `<div class="tracker">${INC_STATUSES.map((s, i) => `<div class="st ${i < INC_STATUSES.indexOf(inc.status) ? "done" : i === INC_STATUSES.indexOf(inc.status) ? "now" : ""}">${s}</div>`).join("")}</div>`;
  let next = "";
  if (inc.status === "Open" && can("investigation_assign")) next += `<button class="btn primary" onclick="ui.assignIncident=${id};go('investigations')">Assign Investigation</button> `;
  if (inv) next += `<button class="btn" onclick="ui.viewInv=${inv.investigation_id};go('investigations')">Open Investigation</button> `;
  if (inv && f && f.root_cause && can("action_create") && !["Resolved", "Closed"].includes(inc.status)) next += `<button class="btn" onclick="ui.actionFilter='';go('actions')">Manage Actions</button> `;
  if (inc.status === "For Action" && can("resolution_record")) next += `<button class="btn" onclick="go('resolutions')">Record Resolution</button> `;
  if (inc.status === "Resolved" && can("incident_close")) next += `<button class="btn success" onclick="ui.closeIncident=${id};go('resolutions')">Review &amp; Close</button> `;
  const auditRows = can("audit_view") ? db.audit.filter(a => a.incident_id === id).slice(-12) : [];
  return `<div class="actions no-print" style="margin:0 0 14px"><button class="btn" onclick="ui.viewIncident=null;renderPage()">← Back to list</button>
    ${editable ? `<button class="btn" onclick="ui.editIncident=${id};ui.viewIncident=null;renderPage()">✏️ Edit</button>` : ""}<button class="btn" onclick="window.print()">🖨️ Print</button></div>
   <div class="card"><h3>${esc(inc.incident_number)} ${statusBadge(inc.status)} ${sevBadge(inc.severity)}</h3>${flow}
    <div class="two-col"><div>
      <p><b>Reporter:</b> ${esc(nameOf(rep, "full_name"))} (${esc(nameOf(rep, "id_number"))})<br><b>Category:</b> ${esc(nameOf(getCategory(inc.category_id), "category_name"))}<br>
      <b>Type:</b> ${esc(nameOf(getType(inc.type_id), "type_name"))}<br><b>Location:</b> ${esc(locName(loc))}${loc ? ` (${esc(loc.area)}, floor ${esc(loc.floor)})` : ""}<br>
      <b>When:</b> ${inc.incident_date} ${inc.incident_time}<br><b>Date reported:</b> ${inc.date_reported}${inc.closure_date ? `<br><b>Closed:</b> ${inc.closure_date}` : ""}</p></div><div>
      <p><b>Description:</b><br>${pre(inc.description)}</p><p><b>Immediate response:</b><br>${pre(inc.immediate_response)}</p></div></div>
    <div class="actions no-print">${next}</div></div>
   <div class="two-col">
    <div class="card"><h3>Attachments</h3>${atts.length ? `<ul>${atts.map(a => `<li>${fileLink(a)} <span class="muted">(${(a.file_size / 1024).toFixed(1)} KB, ${a.uploaded_at})</span></li>`).join("")}</ul>` : `<p class="muted">No attachments.</p>`}
      ${(can("incident_create") || can("incident_edit")) && inc.status !== "Closed" ? `<div class="no-print"><input id="att_file" type="file"><div class="actions"><button class="btn small" onclick="uploadAttachment(${id})">Upload</button></div></div>` : ""}</div>
    <div class="card"><h3>Investigation</h3>${inv ? `<p><b>Investigator:</b> ${esc(nameOf(getUser(inv.investigator_id), "full_name"))}<br><b>Status:</b> ${esc(inv.status)}${invOverdue(inv) ? ` <span class="badge red">OVERDUE</span>` : ""}<br>
      <b>Period:</b> ${inv.start_date} to ${inv.target_date}${inv.completion_date ? `<br><b>Completed:</b> ${inv.completion_date}` : ""}</p>
      <p><b>Root cause:</b> ${f && f.root_cause ? pre(f.root_cause) : `<span class="muted">not recorded</span>`}</p>` : `<p class="muted">Not yet assigned.</p>`}</div></div>
   <div class="card"><h3>Actions</h3><div class="table-wrap"><table class="data"><thead><tr><th>Type</th><th>Description</th><th>Responsible</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead><tbody>
    ${acts.length ? acts.map(a => `<tr class="${!isDone(a) && a.target_date < today() ? "row-bad" : ""}"><td>${esc(a.action_type)}</td><td>${esc(a.description)}</td><td>${esc(nameOf(getUser(a.responsible_id), "full_name"))}</td><td>${a.target_date}</td><td>${sevBadge(a.priority)}</td><td>${esc(a.status)}</td></tr>`).join("") : emptyRow(6, "No actions yet.")}</tbody></table></div></div>
   <div class="card"><h3>Resolution</h3>${res ? `<p><b>${esc(res.resolution_type)}</b> on ${res.resolution_date} by ${esc(nameOf(getUser(res.resolved_by), "full_name"))}<br>${pre(res.description)}</p>` : `<p class="muted">Not resolved yet.</p>`}</div>
   <div class="card"><h3>Traceable Lifecycle (Lab 33)</h3>${timelineHtml(id)}</div>
   ${auditRows.length ? `<div class="card"><h3>Audit trail (latest)</h3><div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>User</th><th>Activity</th><th>Before → After</th></tr></thead><tbody>
    ${auditRows.map(a => `<tr><td>${esc(a.logged_at)}</td><td>${esc(nameOf(getUser(a.user_id), "full_name"))}</td><td>${esc(a.activity)}</td><td>${esc(a.previous_value)} → ${esc(a.new_value)}</td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
}
function timelineHtml(id) {
  return `<div class="timeline">${traceIncident(id).map(s => `<div class="ev ${s.done ? "done" : ""}"><b>${s.done ? "✔ " : "○ "}${esc(s.step)}</b><span class="${s.done ? "" : "muted"}">${esc(s.text)}</span></div>`).join("")}</div>`;
}

/* =================== REPORTERS (Labs 4-6) =================== */
const visibleReporters = () => roleName(currentUser) === R.REP ? db.reporters.filter(r => r.reporter_id === currentUser.reporter_id) : db.reporters;
RENDER.reporters = () => {
  if (ui.viewReporter) return reporterProfileHtml(ui.viewReporter);
  const edit = ui.editReporter ? getReporter(ui.editReporter) : null;
  const e = edit || { id_number: "", full_name: "", department_id: "", position: "", contact_number: "", email: "", address: "", reporter_type: "" };
  const form = can("reporter_manage") ? `<div class="card"><h3>${edit ? "Edit Reporter" : "Register Reporter"}</h3><form novalidate onsubmit="submitReporter(event)"><div class="grid">
    ${fld("rf_id", "Employee/Student ID *", e.id_number, { ph: "EMP-1010" })}${fld("rf_name", "Full Name *", e.full_name)}
    ${sel("rf_dept", "Department *", deptItems(), e.department_id, "-- Select department --")}${fld("rf_pos", "Position", e.position)}
    ${sel("rf_type", "Reporter Type *", REPORTER_TYPES.map(t => [t, t]), e.reporter_type, "-- Select type --")}
    ${fld("rf_contact", "Contact Number", e.contact_number, { ph: "0917-123-4567" })}${fld("rf_email", "Email", e.email)}${fld("rf_addr", "Address", e.address)}</div>
    <div class="actions"><button class="btn primary" type="submit">${edit ? "Update Reporter" : "Register Reporter"}</button>${edit ? `<button class="btn" type="button" onclick="ui.editReporter=null;renderPage()">Cancel</button>` : ""}</div></form></div>` : "";
  return form + `<div class="card"><h3>Reporter Records</h3><div class="row">
    <div style="flex:2"><label>Search by name or ID</label><input id="rs_q" oninput="ui.pg.rep=1;refreshReporters()" placeholder="🔍 name or ID"></div>
    <div><label>Department</label><select id="rs_dept" onchange="ui.pg.rep=1;refreshReporters()">${optionList(db.departments, d => d.department_id, d => d.department_name, "", "All")}</select></div>
    <div><label>Type</label><select id="rs_type" onchange="ui.pg.rep=1;refreshReporters()">${optionList(REPORTER_TYPES, t => t, t => t, "", "All")}</select></div></div>
    <div id="repList">${reporterListHtml()}</div></div>`;
};
function reporterListHtml() {
  const q = val("rs_q").toLowerCase(), d = val("rs_dept"), t = val("rs_type");
  const list = visibleReporters().filter(r => (!q || (r.full_name + " " + r.id_number).toLowerCase().includes(q)) && (!d || r.department_id == d) && (!t || r.reporter_type === t));
  const p = paginate(list, "rep", "refreshReporters");
  return `<div class="table-wrap"><table class="data"><thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Type</th><th>Contact</th><th>Incidents</th><th>Status</th><th></th></tr></thead><tbody>
   ${p.rows.length ? p.rows.map(r => `<tr><td>${esc(r.id_number)}</td><td>${esc(r.full_name)}</td><td>${esc(nameOf(getDept(r.department_id), "department_name"))}</td><td>${esc(r.reporter_type)}</td><td>${esc(r.contact_number)}</td>
    <td class="num">${db.incidents.filter(i => i.reporter_id === r.reporter_id).length}</td><td>${activeBadge(r.status)}</td><td><button class="btn small" onclick="ui.viewReporter=${r.reporter_id};renderPage()">Profile</button>
    ${can("reporter_manage") ? `<button class="btn small" onclick="ui.editReporter=${r.reporter_id};renderPage()">Edit</button><button class="btn small" onclick="redraw(run(()=>toggleStatus('reporters','reporter_id',${r.reporter_id},currentUser,'Reporter')))">${r.status === "Active" ? "Deactivate" : "Activate"}</button>` : ""}</td></tr>`).join("") : emptyRow(8, "No reporters found.")}</tbody></table></div>${p.html}`;
}
function refreshReporters() { $("repList").innerHTML = reporterListHtml(); }
function submitReporter(ev) {
  ev.preventDefault();
  const d = { id_number: val("rf_id"), full_name: val("rf_name"), department_id: val("rf_dept"), position: val("rf_pos"), reporter_type: val("rf_type"), contact_number: val("rf_contact"), email: val("rf_email"), address: val("rf_addr") };
  const r = run(() => ui.editReporter ? updateReporter(ui.editReporter, d, currentUser) : addReporter(d, currentUser));
  if (r.ok) { ui.editReporter = null; redraw(r); } else say(r);
}
function reporterProfileHtml(id) {
  const r = getReporter(id), hist = reporterProfile(id), cats = countBy(hist, h => (getCategory(h.inc.category_id) || {}).category_name);
  return `<div class="actions" style="margin:0 0 14px"><button class="btn" onclick="ui.viewReporter=null;renderPage()">← Back</button></div>
   <div class="card"><h3>${esc(r.full_name)} ${activeBadge(r.status)}</h3><div class="two-col"><div>
    <p><b>ID:</b> ${esc(r.id_number)}<br><b>Type:</b> ${esc(r.reporter_type)}<br><b>Department:</b> ${esc(nameOf(getDept(r.department_id), "department_name"))}<br><b>Position:</b> ${esc(r.position)}</p></div><div>
    <p><b>Contact:</b> ${esc(r.contact_number)}<br><b>Email:</b> ${esc(r.email)}<br><b>Address:</b> ${esc(r.address)}</p></div></div></div>
   <div class="stat-grid"><div class="stat"><div class="n">${hist.length}</div><div class="t">Incidents reported</div></div>
    <div class="stat green"><div class="n">${hist.filter(h => h.inc.status === "Closed" || h.inc.status === "Resolved").length}</div><div class="t">Resolved / Closed</div></div>
    <div class="stat orange"><div class="n">${hist.filter(h => !["Closed", "Resolved"].includes(h.inc.status)).length}</div><div class="t">Still open</div></div></div>
   <div class="card"><h3>Incident categories</h3><p>${Object.keys(cats).map(k => `<span class="badge blue">${esc(k)}: ${cats[k]}</span>`).join(" ") || "<span class='muted'>None</span>"}</p>
   <h3>Previous incidents</h3><div class="table-wrap"><table class="data"><thead><tr><th>Incident</th><th>Date</th><th>Category</th><th>Status</th><th>Investigation</th><th>Resolution</th></tr></thead><tbody>
   ${hist.length ? hist.map(h => `<tr><td><a href="#" onclick="openIncident(${h.inc.incident_id});return false">${esc(h.inc.incident_number)}</a></td><td>${h.inc.incident_date}</td><td>${esc(nameOf(getCategory(h.inc.category_id), "category_name"))}</td><td>${statusBadge(h.inc.status)}</td><td>${esc(h.invStatus)}</td><td>${esc(h.resStatus)}</td></tr>`).join("") : emptyRow(6, "No incidents reported.")}</tbody></table></div></div>`;
}

/* =================== CLASSIFICATION (Lab 7) =================== */
RENDER.classification = () => `<div class="two-col">
  <div class="card"><h3>Incident Categories</h3><div class="row"><div><input id="cl_cat" placeholder="New category name"></div><div style="flex:0"><button class="btn primary" onclick="doAddCategory()">Add</button></div></div>
   <table class="data"><thead><tr><th>Category</th><th class="num">Types</th><th>Status</th><th></th></tr></thead><tbody>
   ${db.categories.map(c => `<tr><td>${esc(c.category_name)}</td><td class="num">${db.types.filter(t => t.category_id === c.category_id).length}</td><td>${activeBadge(c.status)}</td>
    <td><button class="btn small" onclick="renameItem('categories','category_id','category_name',${c.category_id})">Rename</button>
    <button class="btn small" onclick="redraw(run(()=>toggleStatus('categories','category_id',${c.category_id},currentUser,'Category')))">${c.status === "Active" ? "Deactivate" : "Activate"}</button></td></tr>`).join("")}</tbody></table></div>
  <div class="card"><h3>Incident Types</h3><div class="row">${sel("cl_tcat", "Category", db.categories.filter(isActive).map(c => [c.category_id, c.category_name]), "", "-- Category --")}
   <div><label>Type name</label><input id="cl_type" placeholder="e.g. Flood"></div><div style="flex:0"><button class="btn primary" onclick="doAddType()">Add</button></div></div>
   <table class="data"><thead><tr><th>Type</th><th>Category</th><th>Status</th><th></th></tr></thead><tbody>
   ${db.types.map(t => `<tr><td>${esc(t.type_name)}</td><td>${esc(nameOf(getCategory(t.category_id), "category_name"))}</td><td>${activeBadge(t.status)}</td>
    <td><button class="btn small" onclick="renameItem('types','type_id','type_name',${t.type_id})">Rename</button>
    <button class="btn small" onclick="redraw(run(()=>toggleStatus('types','type_id',${t.type_id},currentUser,'Type')))">${t.status === "Active" ? "Deactivate" : "Activate"}</button></td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>Departments</h3><div class="row"><div><input id="cl_dept" placeholder="New department name"></div><div style="flex:0"><button class="btn primary" onclick="doAddDept()">Add</button></div></div>
   <p>${db.departments.map(d => `<span class="badge ${d.status === "Active" ? "blue" : "gray"}" style="cursor:pointer;margin:2px" title="Click to ${d.status === "Active" ? "deactivate" : "activate"}" onclick="redraw(run(()=>toggleStatus('departments','department_id',${d.department_id},currentUser,'Department')))">${esc(d.department_name)}</span>`).join(" ")}</p></div>`;
const doAddCategory = () => redraw(run(() => addCategory(val("cl_cat"), currentUser)));
const doAddType = () => redraw(run(() => addType(val("cl_tcat"), val("cl_type"), currentUser)));
const doAddDept = () => redraw(run(() => addDepartment(val("cl_dept"), currentUser)));
function renameItem(list, key, field, id) { const n = prompt("New name:", find(list, key, id)[field]); if (n !== null) redraw(run(() => renameRef(list, key, field, id, n.trim(), currentUser))); }

/* =================== LOCATIONS (Labs 11-13) =================== */
RENDER.locations = () => {
  const edit = ui.editLocation ? getLocation(ui.editLocation) : null, e = edit || { building: "", room: "", area: "", department_id: "", floor: "", description: "" };
  const form = can("refdata_manage") ? `<div class="card"><h3>${edit ? "Edit Location" : "Register Location"}</h3><form novalidate onsubmit="submitLocation(event)"><div class="grid">
    ${fld("lf_b", "Building *", e.building)}${fld("lf_r", "Room / Office", e.room)}${fld("lf_a", "Area", e.area)}${sel("lf_d", "Department", deptItems(), e.department_id, "-- none --")}${fld("lf_f", "Floor", e.floor)}${fld("lf_desc", "Location Description", e.description)}</div>
    <div class="actions"><button class="btn primary" type="submit">${edit ? "Update" : "Save Location"}</button>${edit ? `<button class="btn" type="button" onclick="ui.editLocation=null;renderPage()">Cancel</button>` : ""}</div></form></div>` : "";
  return form + `<div class="card"><h3>Location List</h3><input id="ls_q" placeholder="🔍 Search building, room, area..." oninput="refreshLocations()" style="max-width:380px;margin-bottom:10px">
   <div id="locList">${locationListHtml()}</div></div>
   <div class="card"><h3>Location-Based Incident Monitoring (Lab 13)</h3><div class="table-wrap"><table class="data"><thead><tr><th>Location</th><th class="num">Incidents</th><th>Incident types</th><th>Severity (L/M/H/C)</th><th class="num">Open</th><th class="num">Resolved</th><th>Recurring?</th></tr></thead><tbody>
   ${db.locations.map(l => { const li = db.incidents.filter(i => i.location_id === l.location_id), tm = countBy(li, i => (getType(i.type_id) || {}).type_name);
     const open = li.filter(i => !["Resolved", "Closed"].includes(i.status)).length; return `<tr class="${li.length >= 2 ? "row-warn" : ""}"><td>${esc(locName(l))}</td><td class="num">${li.length}</td>
     <td>${Object.keys(tm).map(k => esc(k) + " ×" + tm[k]).join(", ") || "-"}</td><td>${SEVERITIES.map(s => li.filter(i => i.severity === s).length).join(" / ")}</td>
     <td class="num">${open}</td><td class="num">${li.length - open}</td><td>${li.length >= 2 ? `<span class="badge orange">Recurring</span>` : "-"}</td></tr>`; }).join("")}</tbody></table></div></div>`;
};
function locationListHtml() {
  const q = val("ls_q").toLowerCase(); const list = db.locations.filter(l => !q || (l.building + l.room + l.area + l.description).toLowerCase().includes(q));
  return `<div class="table-wrap"><table class="data"><thead><tr><th>Building</th><th>Room</th><th>Area</th><th>Department</th><th>Floor</th><th>Status</th><th></th></tr></thead><tbody>
   ${list.length ? list.map(l => `<tr><td>${esc(l.building)}</td><td>${esc(l.room)}</td><td>${esc(l.area)}</td><td>${esc(nameOf(getDept(l.department_id), "department_name") || "")}</td><td>${esc(l.floor)}</td><td>${activeBadge(l.status)}</td>
   <td>${can("refdata_manage") ? `<button class="btn small" onclick="ui.editLocation=${l.location_id};renderPage()">Edit</button><button class="btn small" onclick="redraw(run(()=>toggleStatus('locations','location_id',${l.location_id},currentUser,'Location')))">${l.status === "Active" ? "Deactivate" : "Activate"}</button>` : ""}</td></tr>`).join("") : emptyRow(7, "No locations found.")}</tbody></table></div>`;
}
const refreshLocations = () => { $("locList").innerHTML = locationListHtml(); };
function submitLocation(ev) {
  ev.preventDefault();
  const d = { building: val("lf_b"), room: val("lf_r"), area: val("lf_a"), department_id: val("lf_d"), floor: val("lf_f"), description: val("lf_desc") };
  const r = run(() => ui.editLocation ? updateLocation(ui.editLocation, d, currentUser) : addLocation(d, currentUser));
  if (r.ok) { ui.editLocation = null; redraw(r); } else say(r);
}
