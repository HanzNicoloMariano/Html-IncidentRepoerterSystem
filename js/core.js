"use strict";
/* =====================================================================
   core.js - DATABASE, HELPERS, LOGIN, PERMISSIONS, AUDIT TRAIL
   The "database" is saved in the browser (localStorage). Every list in
   `db` below is one table from schema.js.
   ===================================================================== */
const DB_NAME = "incident_reporting_system";
/* ===================== PROGRESS SETTING =====================
   Change this ONE number as you finish more labs, then upload this file again.
   Example: 20 = only Labs 1-20 are visible. 63 = everything is visible.        */
const UNLOCKED_LAB = 20;
const TOTAL_LABS = 63;
const SESSION_MINUTES = 30;          // Lab 34: automatic logout after this much idle time
let db = null;                       // the whole database
let currentUser = null;              // who is logged in
let testMode = false;                // true while auto-tests run (nothing is saved)
let simulateDbFailure = false;       // Lab 48: pretend the database is down
let fakeToday = null;                // used only for the sample data
let flash = null;                    // message shown after a page re-draws

/* ---------- small helpers ---------- */
const $ = id => document.getElementById(id);
const val = id => { const e = $(id); return e ? e.value.trim() : ""; };
const ok = (msg, data) => ({ ok: true, msg, data });
const fail = msg => ({ ok: false, msg });
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function realToday() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const today = () => fakeToday || realToday();
function dateValid(s) {                     // "2026-10-31" -> true, "2026-02-31" -> false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(s + "T00:00:00");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
const monthOf = d => String(d).slice(0, 7);
function hashPw(pw) {                       // learning only - real systems hash on a server
  let h = 5381;
  for (const ch of String(pw)) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return "h" + (h >>> 0);
}
function passwordProblem(pw) {
  if (String(pw).length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain at least one letter and one number.";
  return null;
}

/* ---------- the database ---------- */
const TABLE_LISTS = ["roles", "departments", "reporters", "users", "categories", "types", "locations", "incidents", "attachments",
  "investigations", "findings", "evidence", "actions", "monitoring", "resolutions", "notifications", "audit", "bugs", "uat", "tests"];
function emptyDb() {
  const d = { counters: {}, checklists: {}, backups: [] };
  TABLE_LISTS.forEach(t => d[t] = []);
  return d;
}
function nextId(name) { db.counters[name] = (db.counters[name] || 0) + 1; return db.counters[name]; }
function save() {
  if (testMode) return;
  if (simulateDbFailure) throw new Error("Cannot connect to the database server");
  try { localStorage.setItem(DB_NAME, JSON.stringify(db)); }
  catch (e) { throw new Error("Storage is full or unavailable"); }
}
// run() turns crashes (like a database failure) into a friendly message - Lab 48
function run(fn) {
  try { return fn(); }
  catch (e) { return fail("Database error: the system could not complete the request (" + e.message + "). Please try again or contact the administrator."); }
}
function loadDb() {
  const raw = localStorage.getItem(DB_NAME);
  if (raw) { try { db = JSON.parse(raw); if (db.incidents) return; } catch (e) { /* corrupted: re-seed */ } }
  seedDemo();
}

/* ---------- lookups ---------- */
const find = (list, key, id) => db[list].find(x => x[key] == id);
const getUser = id => find("users", "user_id", id);
const getReporter = id => find("reporters", "reporter_id", id);
const getIncident = id => find("incidents", "incident_id", id);
const getLocation = id => find("locations", "location_id", id);
const getCategory = id => find("categories", "category_id", id);
const getType = id => find("types", "type_id", id);
const getDept = id => find("departments", "department_id", id);
const getInvestigation = id => find("investigations", "investigation_id", id);
const getAction = id => find("actions", "action_id", id);
const invOfIncident = incId => db.investigations.find(i => i.incident_id == incId);
const findingsOf = invId => db.findings.find(f => f.investigation_id == invId);
const actionsOfIncident = incId => db.actions.filter(a => a.incident_id == incId);
const resolutionOf = incId => db.resolutions.find(r => r.incident_id == incId);
const userByName = name => db.users.find(u => u.username === name);
const roleName = u => u ? ((find("roles", "role_id", u.role_id) || {}).role_name || "") : "";
const nameOf = (obj, f) => obj ? obj[f] : "(missing)";
const locName = l => l ? l.building + (l.room ? " - " + l.room : "") : "(missing)";
const usersWithRole = r => db.users.filter(u => u.status === "Active" && roleName(u) === r);

/* ---------- roles & permissions (Labs 35-36) ---------- */
const R = { ADMIN: "Administrator", REP: "Reporter", IO: "Incident Officer", INV: "Investigator", AO: "Action Officer", SUP: "Supervisor", MGT: "Management" };
const PERMS = {                          // permission -> roles that have it
  reporter_manage: [R.ADMIN, R.IO],
  incident_create: [R.ADMIN, R.REP, R.IO, R.SUP],
  incident_edit: [R.ADMIN, R.IO],
  incident_edit_closed: [R.ADMIN, R.SUP],
  refdata_manage: [R.ADMIN, R.IO],
  investigation_assign: [R.ADMIN, R.IO, R.SUP],
  investigation_work: [R.ADMIN, R.INV],
  evidence_view: [R.ADMIN, R.INV, R.IO, R.SUP],
  action_create: [R.ADMIN, R.IO, R.SUP, R.INV],
  action_update: [R.ADMIN, R.SUP, R.AO, R.IO],
  action_verify: [R.ADMIN, R.SUP, R.IO],
  resolution_record: [R.ADMIN, R.IO, R.SUP],
  incident_close: [R.ADMIN, R.SUP],
  status_change: [R.ADMIN, R.IO, R.SUP],
  users_manage: [R.ADMIN],
  audit_view: [R.ADMIN, R.SUP],
  reports_view: [R.ADMIN, R.IO, R.SUP, R.MGT]
};
const can = (perm, user) => { user = user || currentUser; return !!user && (PERMS[perm] || []).includes(roleName(user)); };
const hasRole = (...names) => !!currentUser && names.includes(roleName(currentUser));

/* ---------- audit trail & notifications (Lab 37, 15, 21) ---------- */
function nowStamp() {
  const d = new Date(), t = fakeToday ? fakeToday : realToday();
  return t + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
}
function audit(actor, activity, incidentId, prev, next, kind) {
  db.audit.push({ audit_id: nextId("audit"), user_id: actor ? actor.user_id : null, activity, incident_id: incidentId || null,
    previous_value: prev == null ? "" : String(prev), new_value: next == null ? "" : String(next), action_performed: kind || "Update", logged_at: nowStamp() });
}
function notify(userId, message, incidentId) {
  if (!userId) return;
  db.notifications.push({ notification_id: nextId("notification"), user_id: userId, message, incident_id: incidentId || null, created_at: today(), is_read: false });
}
const unreadCount = () => currentUser ? db.notifications.filter(n => n.user_id === currentUser.user_id && !n.is_read).length : 0;

/* ---------- login / sessions (Lab 34) ---------- */
function authenticate(username, password) {
  const u = db.users.find(x => x.username.toLowerCase() === String(username).toLowerCase());
  if (!u || u.status !== "Active" || u.password_hash !== hashPw(password)) return null;
  return u;
}
function addUserRecord(username, password, fullName, roleNameText, email, extra) {
  const role = db.roles.find(r => r.role_name === roleNameText);
  const u = Object.assign({ user_id: nextId("user"), username, password_hash: hashPw(password), full_name: fullName, email: email || "",
    role_id: role.role_id, department_id: null, reporter_id: null, status: "Active", must_change: false }, extra || {});
  db.users.push(u); return u;
}
