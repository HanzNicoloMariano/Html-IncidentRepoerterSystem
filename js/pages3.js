"use strict";
/* =====================================================================
   pages3.js - NOTIFICATIONS, ACCOUNT, USERS & ROLES, AUDIT TRAIL,
               SETUP, DATABASE DESIGN, MANUAL, TECHNICAL DOCS, LAB MAP
   (Labs 1-3, 34-37, 60-61)
   ===================================================================== */

/* =================== NOTIFICATIONS =================== */
RENDER.notifications = () => {
  const list = db.notifications.filter(n => n.user_id === currentUser.user_id).sort((a, b) => b.notification_id - a.notification_id);
  const p = paginate(list, "notif", "refreshNotifs");
  return `<div class="card"><div class="actions" style="margin:0 0 10px"><h3 style="margin:0;flex:1">My Notifications (${unreadCount()} unread)</h3><button class="btn small" onclick="markAllRead()">Mark all as read</button></div>
   <div id="notifList">${notifHtml(p)}</div></div>`;
};
const notifHtml = p => `<div class="table-wrap"><table class="data"><tbody>${p.rows.length ? p.rows.map(n => `<tr class="${n.is_read ? "" : "row-warn"}"><td style="width:100px">${n.created_at}</td>
  <td>${n.is_read ? "" : "<b>● </b>"}${esc(n.message)}</td><td style="width:90px">${n.incident_id && canSeeIncident(n.incident_id) ? `<button class="btn small" onclick="readNotif(${n.notification_id},${n.incident_id})">Open</button>` : ""}</td></tr>`).join("") : emptyRow(3, "No notifications.")}</tbody></table></div>${p.html}`;
function refreshNotifs() { renderPage(); }
function readNotif(id, incId) { const n = find("notifications", "notification_id", id); n.is_read = true; run(() => { save(); return ok(""); }); openIncident(incId); }
function markAllRead() { db.notifications.filter(n => n.user_id === currentUser.user_id).forEach(n => n.is_read = true); run(() => { save(); return ok(""); }); renderPage(); }

/* =================== MY ACCOUNT (Lab 34) =================== */
RENDER.account = () => `<div class="two-col"><div class="card"><h3>My Profile</h3>
  <p><b>Name:</b> ${esc(currentUser.full_name)}<br><b>Username:</b> ${esc(currentUser.username)}<br><b>Role:</b> ${esc(roleName(currentUser))}<br><b>Email:</b> ${esc(currentUser.email)}<br>
  <b>Department:</b> ${esc(nameOf(getDept(currentUser.department_id), "department_name") || "-")}</p>
  <p class="muted">Your session ends automatically after ${SESSION_MINUTES} minutes without activity.</p></div>
  <div class="card"><h3>Change Password</h3>${currentUser.must_change ? `<p class="flash info">You must choose a new password before continuing.</p>` : ""}
  <label>Current password</label><input id="pw_old" type="password" autocomplete="current-password"><label>New password (8+ characters, letters and numbers)</label><input id="pw_new" type="password" autocomplete="new-password">
  <label>Confirm new password</label><input id="pw_new2" type="password" autocomplete="new-password"><div class="actions"><button class="btn primary" onclick="changePassword()">Change Password</button></div></div></div>`;
function changePassword() {
  const old = $("pw_old").value, n = $("pw_new").value, n2 = $("pw_new2").value;
  if (hashPw(old) !== currentUser.password_hash) return say(fail("Error: Current password is incorrect."));
  const p = passwordProblem(n); if (p) return say(fail("Error: " + p));
  if (n !== n2) return say(fail("Error: The new passwords do not match."));
  if (n === old) return say(fail("Error: The new password must be different."));
  const r = run(() => { currentUser.password_hash = hashPw(n); currentUser.must_change = false; audit(currentUser, "Changed password", null, "", "", "Update"); save(); return ok("Password changed."); });
  redraw(r);
}

/* =================== USERS & ROLES (Labs 34-36) =================== */
const PERM_LABELS = { reporter_manage: "Register / manage reporters", incident_create: "Submit incidents", incident_edit: "Edit incident records", incident_edit_closed: "Edit CLOSED incidents",
  refdata_manage: "Manage categories, types, locations", investigation_assign: "Assign investigations", investigation_work: "Work on investigations", evidence_view: "View investigation evidence",
  action_create: "Create corrective actions", action_update: "Update action status", action_verify: "Verify actions", resolution_record: "Record final resolution", incident_close: "Close incidents",
  status_change: "Change incident status", users_manage: "Manage users and system", audit_view: "View audit trail", reports_view: "View reports and dashboards" };
RENDER.users = () => `<div class="card"><h3>Add User</h3><div class="grid">
  ${fld("uf_name", "Full Name *", "")}${fld("uf_user", "Username *", "")}${fld("uf_email", "Email", "")}
  <div><label>Password * (8+ chars, letters and numbers)</label><input id="uf_pass" type="password"></div>
  ${sel("uf_role", "Role *", db.roles.map(r => [r.role_id, r.role_name]), "", "-- Select role --")}
  ${sel("uf_rep", "Linked reporter (Reporter role only)", db.reporters.map(r => [r.reporter_id, r.full_name]), "", "-- none --")}</div>
  <div class="actions"><button class="btn primary" onclick="addUserUi()">Save User</button></div></div>
  <div class="card"><h3>User Accounts</h3><div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
  ${db.users.map(u => `<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><select ${u.user_id === currentUser.user_id ? "disabled" : ""} onchange="changeRole(${u.user_id},this.value)">${optionList(db.roles, r => r.role_id, r => r.role_name, u.role_id)}</select></td>
   <td>${activeBadge(u.status)}</td><td>${u.user_id === currentUser.user_id ? `<span class="muted">(you)</span>` : `<button class="btn small" onclick="toggleUser(${u.user_id})">${u.status === "Active" ? "Deactivate" : "Activate"}</button>`}
   <button class="btn small" onclick="adminReset(${u.user_id})">Reset Password</button></td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>Lab 35: User Roles</h3><table class="data"><thead><tr><th>Role</th><th>Responsibility</th></tr></thead><tbody>${db.roles.map(r => `<tr><td><b>${esc(r.role_name)}</b></td><td>${esc(r.description)}</td></tr>`).join("")}</tbody></table></div>
  <div class="card"><h3>Lab 36: Role-Based Access Control (what each role may do)</h3><div class="table-wrap"><table class="data"><thead><tr><th>Permission</th>${db.roles.map(r => `<th>${esc(r.role_name)}</th>`).join("")}</tr></thead><tbody>
  ${Object.keys(PERMS).map(k => `<tr><td>${PERM_LABELS[k] || k}</td>${db.roles.map(r => `<td style="text-align:center">${PERMS[k].includes(r.role_name) ? "✔" : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
  <p class="muted">Also: a Reporter sees only their own incidents; an Investigator only investigations assigned to them; an Action Officer only their own actions.</p></div>`;
function addUserUi() {
  const name = val("uf_name"), user = val("uf_user"), pass = $("uf_pass").value, role = db.roles.find(r => r.role_id == val("uf_role"));
  if (!name || !user) return say(fail("Error: Name and username are required."));
  if (!role) return say(fail("Error: Please select a role."));
  const p = passwordProblem(pass); if (p) return say(fail("Error: " + p));
  if (db.users.some(u => u.username.toLowerCase() === user.toLowerCase())) return say(fail("Error: Username already exists."));
  if (val("uf_rep") && role.role_name !== R.REP) return say(fail("Error: Only users with the Reporter role can be linked to a reporter record."));
  redraw(run(() => { addUserRecord(user, pass, name, role.role_name, val("uf_email"), { reporter_id: val("uf_rep") ? Number(val("uf_rep")) : null });
    audit(currentUser, "Created user " + user, null, "", role.role_name, "Create"); save(); return ok("User created."); }));
}
function changeRole(id, roleId) {
  const u = getUser(id), old = roleName(u); u.role_id = Number(roleId);
  redraw(run(() => { audit(currentUser, "Changed role of " + u.username, null, old, roleName(u), "Update"); save(); return ok("Role updated."); }));
}
function toggleUser(id) {
  const u = getUser(id), old = u.status; u.status = old === "Active" ? "Inactive" : "Active";
  redraw(run(() => { audit(currentUser, "Account " + u.status + ": " + u.username, null, old, u.status, "Status Change"); save(); return ok(u.username + " is now " + u.status + "."); }));
}
function adminReset(id) {
  const u = getUser(id), temp = "Temp" + Math.floor(100000 + Math.random() * 900000); u.password_hash = hashPw(temp); u.must_change = true;
  redraw(run(() => { audit(currentUser, "Reset password of " + u.username, null, "", "", "Update"); save(); return ok("Temporary password for " + u.username + ": " + temp + " (they must change it at next login)."); }));
}

/* =================== AUDIT TRAIL (Lab 37) =================== */
RENDER.audit = () => `<div class="card"><h3>Audit Trail (complete transaction history)</h3><div class="row"><div style="flex:2"><label>Search (user, activity, incident number, action)</label><input id="au_q" value="${esc(ui.auditFilter)}" oninput="ui.auditFilter=this.value;ui.pg.audit=1;refreshAudit()"></div></div>
  <div id="auditList">${auditHtml()}</div></div>`;
function auditHtml() {
  const q = ui.auditFilter.toLowerCase();
  const list = db.audit.slice().reverse().filter(a => !q || ((nameOf(getUser(a.user_id), "full_name")) + " " + a.activity + " " + (getIncident(a.incident_id) || {}).incident_number + " " + a.action_performed).toLowerCase().includes(q));
  const p = paginate(list, "audit", "refreshAudit");
  return `<div class="table-wrap"><table class="data"><thead><tr><th>Date/Time</th><th>User</th><th>Activity</th><th>Incident</th><th>Previous</th><th>New</th><th>Action</th></tr></thead><tbody>
  ${p.rows.length ? p.rows.map(a => `<tr><td style="white-space:nowrap">${esc(a.logged_at)}</td><td>${esc(a.user_id ? nameOf(getUser(a.user_id), "full_name") : "(anonymous)")}</td><td>${esc(a.activity)}</td><td>${esc((getIncident(a.incident_id) || {}).incident_number || "")}</td>
  <td>${esc(a.previous_value)}</td><td>${esc(a.new_value)}</td><td><span class="badge gray">${esc(a.action_performed)}</span></td></tr>`).join("") : emptyRow(7, "No audit records.")}</tbody></table></div>${p.html}`;
}
const refreshAudit = () => { $("auditList").innerHTML = auditHtml(); };

/* =================== PROJECT SETUP (Lab 1) =================== */
RENDER.setup = () => `<div class="card"><h3>Lab 1 – Project Setup</h3>
  <p><b>Tools:</b> a code editor (VS Code) and a web browser. No server or database software is needed for this HTML + CSS + JavaScript version.</p>
  <p><b>Application structure:</b></p>
<pre class="tree">IRS/
├── index.html        ← the page: login screen + layout
├── style.css         ← colors, layout, tables, print styles
├── database.sql      ← the same database written in SQL (for MySQL)
└── js/
    ├── schema.js     ← database design (tables, fields, keys)
    ├── core.js       ← database access, login, permissions, audit
    ├── logic.js      ← business rules and validation
    ├── seed.js       ← sample data
    ├── pages1.js     ← dashboard, incidents, reporters, locations
    ├── pages2.js     ← investigations, actions, resolutions, reports
    ├── pages3.js     ← users, audit, setup, design, docs
    └── pages4.js     ← testing, backup, deployment, final demo</pre>
  <p><b>How to run:</b> open <code>index.html</code> in a browser (double-click it). <b>Source-code repository:</b> upload the folder to GitHub (see the Backup &amp; Deployment page).</p></div>
 <div class="card"><h3>Environment / Database Settings</h3><table class="data"><tbody>
  <tr><td>Database name</td><td><code>${DB_NAME}</code></td></tr><tr><td>Storage engine</td><td>Browser localStorage (database.sql shows the MySQL version)</td></tr>
  <tr><td>Labs unlocked</td><td>Labs 1-${UNLOCKED_LAB} of ${TOTAL_LABS} (<code>UNLOCKED_LAB</code> in core.js)</td></tr>
  <tr><td>Session timeout</td><td>${SESSION_MINUTES} minutes</td></tr><tr><td>Records per page</td><td>${PAGE_SIZE}</td></tr>
  <tr><td>Maximum upload size</td><td>${MAX_FILE / 1024} KB (allowed: ${ALLOWED_EXT.join(", ")})</td></tr><tr><td>Today's date</td><td>${today()}</td></tr></tbody></table>
  <div class="actions"><button class="btn primary" onclick="testConnection()">🔌 Test Application-Database Connection</button></div><div id="connResult" style="margin-top:10px"></div></div>
 <div class="card"><h3>Initial Application Interface</h3><p>You are looking at it: login → role-based menu → dashboard. The homepage shown after login depends on your role.</p></div>`;
function testConnection() {
  try {
    localStorage.setItem("irs_conn_test", "ok"); const back = localStorage.getItem("irs_conn_test"); localStorage.removeItem("irs_conn_test");
    const saved = localStorage.getItem(DB_NAME); if (back !== "ok" || !saved) throw new Error("could not read back from storage");
    const tables = SCHEMA.length;
    $("connResult").innerHTML = `<div class="flash ok">✔ Connected to database "${DB_NAME}". Read/write test passed. ${tables} tables defined, ${(saved.length / 1024).toFixed(1)} KB stored.</div>`;
  } catch (e) { $("connResult").innerHTML = `<div class="flash err">✖ Connection failed: ${esc(e.message)}</div>`; }
}

/* =================== DATABASE DESIGN (Labs 2-3) =================== */
function erdHtml() {
  return `<div class="erd">${SCHEMA.map(t => `<div class="ent"><h5>${t.name}</h5>${t.fields.map(f => { const c = f[2].split(" "), fk = c.find(x => x.startsWith("FK:"));
    return `<div class="${c.includes("PK") ? "pk" : fk ? "fk" : ""}">${c.includes("PK") ? "🔑 " : fk ? "🔗 " : ""}${f[0]}<span>${f[1]}${c.includes("UQ") ? " UQ" : ""}</span></div>`; }).join("")}</div>`).join("")}</div>
  <p class="muted">🔑 = primary key · 🔗 = foreign key (orange) · UQ = unique</p>`;
}
function relationshipsHtml() {
  const rows = []; SCHEMA.forEach(t => t.fields.forEach(f => f[2].split(" ").filter(c => c.startsWith("FK:")).forEach(c => rows.push([t.name + "." + f[0], c.slice(3), f[2].includes("UQ") ? "one-to-one" : "many-to-one"]))));
  return `<div class="table-wrap"><table class="data"><thead><tr><th>Foreign key</th><th>References</th><th>Relationship</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>`;
}
function dictionaryHtml() {
  return SCHEMA.map(t => `<h4>${t.name} <span class="muted" style="font-weight:normal">– ${esc(t.note)}</span></h4><div class="table-wrap"><table class="data"><thead><tr><th>Field</th><th>Type</th><th>Key / Constraint</th><th>Description</th></tr></thead><tbody>
   ${t.fields.map(f => `<tr><td><code>${f[0]}</code></td><td>${f[1]}</td><td>${esc(f[2].replace("PK", "Primary key").replace("UQ", "Unique").replace("NN", "Required").replace(/FK:/g, "FK → "))}</td><td>${esc(f[3])}</td></tr>`).join("")}</tbody></table></div>`).join("");
}
RENDER.design = () => `<div class="card"><h3>Lab 2 – Entity Relationship Diagram (ERD)</h3>${erdHtml()}
  <h4>Final system relationship</h4><pre class="tree">REPORTER → INCIDENT ──► LOCATION
              │
              ▼
        INVESTIGATION ── Evidence / Findings / Root Cause
              │
              ▼
           ACTION → RESOLUTION → CLOSURE → REPORTS / DASHBOARD</pre></div>
  <div class="card"><h3>Relationships (primary keys → foreign keys)</h3>${relationshipsHtml()}</div>
  <div class="card"><h3>Normalization &amp; Lookup Tables</h3><ul><li><b>1NF:</b> every field holds one value (no lists in a cell).</li>
   <li><b>2NF/3NF:</b> repeated information lives in its own table: departments, roles, categories and types are <b>lookup/reference tables</b>; incidents store only their IDs.</li>
   <li>Findings, evidence, actions and resolutions are separate tables linked by <code>incident_id</code> / <code>investigation_id</code>.</li></ul></div>
  <div class="card"><h3>Lab 3 – Tables, Indexes and Relationship Test</h3>
   <p>Tables created: <b>${SCHEMA.length}</b>. Indexes: ${INDEXES.map(i => `<code>${i[0]}.${i[1]}</code>`).join(", ")}. Initial reference data: roles, departments, categories, types.</p>
   <table class="data"><thead><tr><th>Table</th><th class="num">Records</th></tr></thead><tbody>${SCHEMA.map(t => `<tr><td>${t.name}</td><td class="num">${db[TABLE_TO_LIST[t.name]].length}</td></tr>`).join("")}</tbody></table>
   <div class="actions"><button class="btn primary" onclick="runRelTest()">Test Database Relationships</button><button class="btn" onclick="download('database.sql', schemaSql(), 'text/plain')">⬇ Download database.sql</button></div><div id="relOut" style="margin-top:10px"></div></div>
  <div class="card"><h3>Data Dictionary</h3>${dictionaryHtml()}</div>`;
function runRelTest() {
  const c = checkRelationships();
  $("relOut").innerHTML = c.problems.length ? `<div class="flash err">✖ ${c.problems.length} broken relationship(s):<br>${c.problems.map(esc).join("<br>")}</div>`
    : `<div class="flash ok">✔ All ${c.checked} foreign key values point to existing records.</div>`;
}

/* =================== USER MANUAL (Lab 60) =================== */
RENDER.manual = () => {
  const s = (t, body) => `<div class="card"><h3>${t}</h3>${body}</div>`;
  return s("1. Login and Logout", "<ol><li>Open the system and type your username and password, then press <b>Login</b>.</li><li>Wrong details show an error. Forgot your password? Press <b>Forgot password?</b> and enter your username and email.</li><li>Press <b>Logout</b> (top right) when finished. You are logged out automatically after 30 minutes of inactivity.</li></ol>") +
    s("2. Registering Reporters", "<p>Reporters → fill the form (ID, name, department, type are required) → <b>Register Reporter</b>. Use the search and filters to find reporters; <b>Profile</b> shows their incident history.</p>") +
    s("3. Reporting Incidents", "<ol><li>Incidents → <b>Report New Incident</b>.</li><li>Choose the category, then the type (types depend on the category), the location, date, time and severity.</li><li>Describe what happened and the immediate response. You may attach a photo or PDF.</li><li>Press <b>Save Incident</b>. A number like IN-2026-0011 is created automatically.</li></ol>") +
    s("4. Recording Locations", "<p>Locations → fill in building, room, area, department and floor → <b>Save Location</b>. Deactivate locations that are no longer used.</p>") +
    s("5. Assigning Investigations", "<p>Investigations → choose a newly reported incident, an investigator, the start and target dates and instructions → <b>Assign &amp; Notify</b>. The incident becomes <i>Under Investigation</i>.</p>") +
    s("6. Recording Findings, Evidence and Root Cause", "<ol><li>The investigator opens the investigation and moves the status step by step: Assigned → In Progress → Evidence Gathering → Findings Prepared → Completed.</li><li>Record findings, upload evidence, and complete the Root Cause Analysis (Problem → Cause → Evidence → Root Cause → Recommendation).</li><li>The investigation can be completed only after findings and root cause are saved.</li></ol>") +
    s("7. Creating Corrective Actions", "<p>Corrective Actions → choose the incident, action type, responsible person, target date and priority. Responsible people are notified. They update the status: Pending → In Progress → Completed; a supervisor then marks it Verified. Overdue actions appear in red.</p>") +
    s("8. Recording Resolutions", "<p>Resolution &amp; Closure → select the incident. The system lists what is still missing (investigation completed? required actions done?). When ready, choose the type, enter the description and date, and press <b>Record Resolution</b>.</p>") +
    s("9. Closing Incidents", "<p>Only a Supervisor or Administrator can close. Open <b>Review &amp; Close</b>, read the summary, tick the confirmation box and press <b>Close Incident</b>. Closed incidents cannot be edited by ordinary users.</p>") +
    s("10. Generating Reports", "<p>Reports → choose one of the 7 reports and an optional date range. Use <b>Print / Save as PDF</b> or <b>Export CSV</b> (opens in Excel).</p>") +
    s("11. Viewing the Dashboard", "<p>The dashboard shows totals, overdue items and charts by category, type, location, severity, month, investigation status and resolution status.</p>") +
    s("12. Troubleshooting", `<table class="data"><thead><tr><th>Message</th><th>What to do</th></tr></thead><tbody>
     <tr><td>Invalid username or password</td><td>Check spelling and caps lock, or use Forgot password.</td></tr>
     <tr><td>Access denied</td><td>Your role cannot do this. Ask the administrator.</td></tr>
     <tr><td>Incident type must belong to the selected category</td><td>Choose the category first, then pick a type from the list.</td></tr>
     <tr><td>Invalid file</td><td>Use JPG, PNG, PDF, DOC, DOCX or TXT files under 300 KB.</td></tr>
     <tr><td>Cannot resolve yet</td><td>Read the list of missing items: finish the investigation or required actions.</td></tr>
     <tr><td>Invalid status transition</td><td>Statuses must follow the workflow order; steps cannot be skipped.</td></tr>
     <tr><td>Database error</td><td>The data could not be saved (storage full or unavailable). Try again or contact the administrator.</td></tr></tbody></table>`);
};

/* =================== TECHNICAL DOCUMENTATION (Lab 61) =================== */
RENDER.techdocs = () => {
  const s = (t, body) => `<div class="card"><h3>${t}</h3>${body}</div>`;
  return s("1. System Architecture", `<pre class="tree">  Browser (HTML + CSS)  ← what the user sees: index.html, style.css
        │ user actions
        ▼
  Page scripts (pages1-4.js)  ← draw screens, read forms, show messages
        │ calls
        ▼
  Business logic (logic.js)   ← rules, validation, permissions, workflow
        │ reads / writes
        ▼
  Database (core.js)          ← tables stored in the browser (localStorage)
                                  same design as database.sql (MySQL)</pre>`) +
    s("2. ERD", erdHtml()) + s("3. Database Schema", relationshipsHtml()) + s("4. Data Dictionary", dictionaryHtml()) +
    s("5. System Requirements", "<ul><li>Any modern browser (Chrome, Edge, Firefox, Safari) with JavaScript enabled.</li><li>About 5 MB of browser storage.</li><li>For hosting: any static web host (GitHub Pages, Netlify) or a school web server.</li></ul>") +
    s("6. Installation Procedures", "<ol><li>Copy the <code>IRS</code> folder to the computer or web server.</li><li>Open <code>index.html</code>.</li><li>Login as <code>admin</code>, then <b>Backup &amp; Deployment → Start Production</b> to remove sample data and change the default passwords.</li><li>For MySQL, run <code>database.sql</code> in phpMyAdmin.</li></ol>") +
    s("7. Configuration", `<p>Settings are constants at the top of the scripts: <code>DB_NAME</code>, <code>UNLOCKED_LAB</code> and <code>SESSION_MINUTES</code> (core.js), <code>MAX_FILE</code>, <code>ALLOWED_EXT</code> and <code>TARGET_DAYS</code> (logic.js), <code>PAGE_SIZE</code> (pages1.js). Role permissions are in <code>PERMS</code> (core.js).</p>`) +
    s("8. Source-Code Structure", "<p>See the folder tree on the <a href='#' onclick=\"go('setup');return false\">Project Setup</a> page. Rule of thumb: <b>logic.js</b> decides what is allowed; <b>pages*.js</b> only display and collect input.</p>") +
    s("9. Security Mechanisms", "<ul><li>Passwords are stored scrambled (hash), with strength rules; reset forces a new password.</li><li>Role-based access control on every page and every action.</li><li>All text is escaped before display (protects against script injection).</li><li>Uploads limited by file type and size; file names checked.</li><li>Automatic logout after inactivity; failed logins are audited.</li><li>Complete audit trail with previous and new values.</li><li><b>Limit:</b> a browser-only version cannot be truly secure; a real deployment needs a server-side database and server-side checks.</li></ul>") +
    s("10. Backup and Recovery Procedures", "<p>Backup &amp; Deployment → <b>Download Backup</b> weekly and before changes. To recover: <b>Restore from File</b>, then <b>Verify Records</b>. Test recovery by simulating a failure.</p>") +
    s("11. Maintenance Procedures", "<ul><li>Weekly: download a backup; review the audit trail and overdue items.</li><li>Monthly: deactivate unused users and locations; review categories and types.</li><li>After changes: run the automatic tests on the Testing page.</li><li>Yearly: review roles and permissions.</li></ul>");
};

/* =================== LAB MAP =================== */
const LAB_MAP = [[1, "Create the Incident Reporting System Project", "setup"], [2, "Design the Incident Reporting Database", "design"], [3, "Create Database Tables and Relationships", "design"],
  [4, "Reporter Registration", "reporters"], [5, "Reporter Search and Management", "reporters"], [6, "Reporter Profile", "reporters"], [7, "Incident Categories and Types", "classification"],
  [8, "Incident Registration", "incidents"], [9, "Incident Validation", "incidents"], [10, "Incident Search and Viewing", "incidents"], [11, "Location Management", "locations"],
  [12, "Integrate Incident with Location", "incidents"], [13, "Location-Based Incident Monitoring", "locations"], [14, "Investigation Module", "investigations"],
  [15, "Investigation Assignment", "investigations"], [16, "Record Investigation Findings", "investigations"], [17, "Evidence Management", "investigations"],
  [18, "Investigation Status Tracking", "investigations"], [19, "Root Cause Analysis", "investigations"], [20, "Corrective Action", "actions"], [21, "Action Assignment", "actions"],
  [22, "Action Monitoring", "actions"], [23, "Overdue Action Monitoring", "actions"], [24, "Incident Resolution", "resolutions"], [25, "Resolution Validation", "resolutions"],
  [26, "Incident Closure", "resolutions"], [27, "Integrate Reporter → Incident", "integration"], [28, "Integrate Incident → Location", "integration"],
  [29, "Integrate Incident → Investigation", "integration"], [30, "Integrate Investigation → Action", "integration"], [31, "Integrate Action → Resolution", "integration"],
  [32, "Integrate Resolution → Closure", "integration"], [33, "Complete End-to-End Workflow", "integration"], [34, "Login and Authentication", "account"], [35, "User Roles", "users"],
  [36, "Role-Based Access Control", "users"], [37, "Audit Trail", "audit"], [38, "Incident Summary Report", "reports"], [39, "Incident Category Report", "reports"],
  [40, "Incident Location Report", "reports"], [41, "Investigation Report", "reports"], [42, "Corrective Action Report", "reports"], [43, "Incident Resolution Report", "reports"],
  [44, "Incident Trend Analysis", "reports"], [45, "Incident Management Dashboard", "dashboard"], [46, "System-Wide Form Validation", "testing"], [47, "Incident Business Rules", "testing"],
  [48, "Error Handling", "testing"], [49, "Unit Testing", "testing"], [50, "Integration Testing", "testing"], [51, "End-to-End Testing", "testing"], [52, "User Acceptance Testing", "uat"],
  [53, "Bug Tracking and Correction", "bugs"], [54, "Database Backup and Recovery", "backup"], [55, "Security Testing", "testing"], [56, "Performance Testing", "testing"],
  [57, "Deployment Preparation", "backup"], [58, "Deploy the System", "backup"], [59, "Post-Deployment Testing", "backup"], [60, "User Manual", "manual"],
  [61, "Technical Documentation", "techdocs"], [62, "Final System Refinement", "final"], [63, "Final System Demonstration", "final"]];
RENDER.labmap = () => `<div class="card"><h3>All ${TOTAL_LABS} labs and where to find them</h3>
  <p><b>Unlocked: Labs 1-${UNLOCKED_LAB}</b> of ${TOTAL_LABS}. <span class="muted">(Change <code>UNLOCKED_LAB</code> at the top of js/core.js as you finish more labs.)</span></p>
  <div class="table-wrap"><table class="data"><thead><tr><th>Lab</th><th>Activity</th><th>Page</th><th>Status</th></tr></thead><tbody>
  ${LAB_MAP.map(l => { const open = l[0] <= UNLOCKED_LAB;
    return `<tr class="${open ? "" : "muted"}"><td>${l[0]}</td><td>${esc(l[1])}</td><td>${open && allowed(l[2]) ? `<a href="#" onclick="go('${l[2]}');return false">${esc(pageDef(l[2]).label)}</a>` : esc(pageDef(l[2]).label)}</td>
    <td>${open ? `<span class="badge green">Unlocked</span>` : `<span class="badge gray">🔒 Locked</span>`}</td></tr>`; }).join("")}</tbody></table></div></div>`;
