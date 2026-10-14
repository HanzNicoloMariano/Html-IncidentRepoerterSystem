"use strict";
/* =====================================================================
   seed.js - SAMPLE DATA
   Creates users, reporters, locations and 10 incidents in different
   stages by calling the SAME functions the pages use (so the sample
   data follows every rule). Dates are faked so trends look realistic.
   ===================================================================== */
function seedDemo() {
  db = emptyDb();
  ROLE_LIST.forEach(r => db.roles.push({ role_id: nextId("role"), role_name: r[0], description: r[1] }));
  DEPT_LIST.forEach(n => db.departments.push({ department_id: nextId("department"), department_name: n, status: "Active" }));
  Object.keys(CATEGORY_TYPES).forEach(c => {
    const cat = { category_id: nextId("category"), category_name: c, status: "Active" }; db.categories.push(cat);
    CATEGORY_TYPES[c].forEach(t => db.types.push({ type_id: nextId("type"), category_id: cat.category_id, type_name: t, status: "Active" }));
  });
  const dept = n => db.departments.find(d => d.department_name === n).department_id;
  [["EMP-1001", "Juan Dela Cruz", "IT Department", "Laboratory Technician", "0917-111-2222", "juan@school.edu", "Tuguegarao City", "Employee"],
   ["STU-2001", "Ana Reyes", "Student Affairs", "3rd Year Student", "0918-222-3333", "ana@school.edu", "Santiago City", "Student"],
   ["EMP-1002", "Mark Santos", "Facilities", "Maintenance Staff", "0919-333-4444", "mark@school.edu", "Ilagan, Isabela", "Employee"],
   ["EMP-1003", "Liza Cruz", "Human Resources", "HR Assistant", "0920-444-5555", "liza@school.edu", "Cauayan City", "Employee"],
   ["VIS-3001", "Pedro Lim", "Security Office", "Visitor", "0921-555-6666", "", "Bambang, Nueva Vizcaya", "Visitor"],
   ["STU-2002", "Grace Tan", "Library", "2nd Year Student", "0922-666-7777", "grace@school.edu", "Solano, Nueva Vizcaya", "Student"]]
    .forEach(a => db.reporters.push({ reporter_id: nextId("reporter"), id_number: a[0], full_name: a[1], department_id: dept(a[2]), position: a[3],
      contact_number: a[4], email: a[5], address: a[6], reporter_type: a[7], status: "Active" }));
  addUserRecord("admin", "admin123", "System Administrator", R.ADMIN, "admin@school.edu", { department_id: dept("IT Department") });
  addUserRecord("reporter", "reporter123", "Juan Dela Cruz", R.REP, "juan@school.edu", { reporter_id: 1, department_id: dept("IT Department") });
  addUserRecord("officer", "officer123", "Olivia Officer", R.IO, "olivia@school.edu", { department_id: dept("Administration") });
  addUserRecord("investigator", "invest123", "Rico Investigator", R.INV, "rico@school.edu", { department_id: dept("Security Office") });
  addUserRecord("investigator2", "invest123", "Liza Tan", R.INV, "liza.tan@school.edu", { department_id: dept("Facilities") });
  addUserRecord("actionofficer", "action123", "Aaron Action", R.AO, "aaron@school.edu", { department_id: dept("Facilities") });
  addUserRecord("actionofficer2", "action123", "Bea Builder", R.AO, "bea@school.edu", { department_id: dept("IT Department") });
  addUserRecord("supervisor", "super123", "Sandra Supervisor", R.SUP, "sandra@school.edu", { department_id: dept("Administration") });
  addUserRecord("manager", "manager123", "Mario Manager", R.MGT, "mario@school.edu", { department_id: dept("Administration") });
  [["Science Building", "IT Laboratory 2", "Laboratory", "IT Department", "2", "Computer laboratory"],
   ["Library Building", "Main Reading Area", "Library", "Library", "1", "Reading and study area"],
   ["Student Center", "Canteen", "Dining", "Student Affairs", "1", "School canteen"],
   ["Campus", "Main Gate", "Entrance", "Security Office", "G", "Main entrance and parking"],
   ["Administration Building", "Room 101", "Office", "Administration", "1", "Administrative office"],
   ["Sports Complex", "Gymnasium", "Sports", "Facilities", "G", "Gym and courts"]]
    .forEach(a => db.locations.push({ location_id: nextId("location"), building: a[0], room: a[1], area: a[2], department_id: dept(a[3]), floor: a[4], description: a[5], status: "Active" }));

  const U = userByName, tid = n => db.types.find(t => t.type_name === n).type_id, cid = n => db.categories.find(c => c.category_name === n).category_id;
  const lid = r => db.locations.find(l => l.room === r).location_id, rid = name => db.reporters.find(r => r.full_name === name).reporter_id;
  const on = (d, fn) => { fakeToday = d; const r = fn(); if (!r.ok) console.warn("seed problem:", r.msg); return r; };
  const incident = (day, rep, cat, type, room, sev, time, desc, resp) => on(day, () => createIncident({ reporter_id: rid(rep), category_id: cid(cat), type_id: tid(type), location_id: lid(room),
    incident_date: day, incident_time: time, description: desc, severity: sev, immediate_response: resp }, U("officer"))).data;
  const assign = (day, inc, who, start, target, text) => on(day, () => assignInvestigation({ incident_id: inc.incident_id, investigator_id: U(who).user_id, start_date: start, target_date: target, instructions: text }, U("officer"))).data;
  const step = (day, inv, who, to) => on(day, () => updateInvestigationStatus(inv.investigation_id, to, U(who)));
  const findings = (day, inv, who, d) => on(day, () => saveFindings(inv.investigation_id, d, U(who)));
  const action = (day, inc, by, type, text, who, target, pr) => on(day, () => createAction({ incident_id: inc.incident_id, action_type: type, description: text, responsible_id: U(who).user_id, target_date: target, priority: pr, is_required: true }, U(by))).data;
  const astep = (day, a, who, to, remarks) => on(day, () => updateActionStatus(a.action_id, to, remarks, U(who)));
  const fullInvestigation = (inv, who, d1, d2, d3, d4, f, r) => {
    step(d1, inv, who, "In Progress"); step(d2, inv, who, "Evidence Gathering");
    findings(d2, inv, who, { findings: f.findings, witnesses: f.witnesses, recommendation: f.recommendation });
    findings(d3, inv, who, { rca_problem: r.problem, rca_cause: r.cause, rca_evidence: r.evidence, immediate_cause: r.immediate, root_cause: r.root, contributing_factors: r.factors, preventive_measures: r.prevent });
    step(d3, inv, who, "Findings Prepared"); step(d4, inv, who, "Completed");
  };

  // 1. The classic demo scenario (fully closed)
  const i1 = incident("2026-08-12", "Juan Dela Cruz", "Safety", "Equipment Accident", "IT Laboratory 2", "High", "14:30",
    "A technician received an electric shock while connecting a computer to a damaged power strip in IT Laboratory 2.", "Power was switched off and the technician was brought to the clinic.");
  const v1 = assign("2026-08-13", i1, "investigator", "2026-08-13", "2026-08-20", "Inspect all power strips in the laboratory and interview the technician.");
  on("2026-08-14", () => addEvidence(v1.investigation_id, { name: "damaged-power-strip.jpg", size: 2048, data: "" }, "Photo of the damaged power strip", U("investigator")));
  fullInvestigation(v1, "investigator", "2026-08-14", "2026-08-15", "2026-08-17", "2026-08-18",
    { findings: "The power strip had exposed wiring and no grounding. It had been used for 6 years without inspection.", witnesses: "Two students present in the laboratory.", recommendation: "Replace all old power strips and add yearly inspection." },
    { problem: "Technician received an electric shock.", cause: "Exposed wiring on the power strip.", evidence: "Photo of damaged strip; inspection of 12 other strips found 3 more damaged.", immediate: "Damaged power strip.", root: "No scheduled electrical inspection of laboratory equipment.", factors: "Old equipment, no replacement budget.", prevent: "Yearly inspection schedule and replacement of damaged strips." });
  const a1 = action("2026-08-19", i1, "officer", "Equipment Repair", "Replace all damaged power strips in IT Laboratory 2.", "actionofficer", "2026-08-26", "High");
  const a2 = action("2026-08-19", i1, "officer", "Training", "Train laboratory staff on electrical safety.", "actionofficer2", "2026-09-02", "Medium");
  astep("2026-08-22", a1, "actionofficer", "In Progress", ""); astep("2026-08-24", a1, "actionofficer", "Completed", "Replaced 4 power strips."); astep("2026-08-25", a1, "supervisor", "Verified", "Checked on site.");
  astep("2026-08-28", a2, "actionofficer2", "In Progress", ""); astep("2026-08-30", a2, "actionofficer2", "Completed", "Training held with 15 attendees."); astep("2026-08-31", a2, "supervisor", "Verified", "");
  on("2026-09-01", () => recordResolution({ incident_id: i1.incident_id, resolution_type: "Corrective Action Implemented", description: "Damaged power strips replaced and staff trained.", resolution_date: "2026-09-01", remarks: "" }, U("officer")));
  on("2026-09-02", () => closeIncident(i1.incident_id, true, "Reviewed all records.", U("supervisor")));

  // 2. Closed
  const i2 = incident("2026-08-20", "Ana Reyes", "Safety", "Slip/Fall", "Main Reading Area", "Medium", "10:15", "A student slipped on a wet floor near the library entrance.", "First aid given by the librarian.");
  const v2 = assign("2026-08-21", i2, "investigator2", "2026-08-21", "2026-08-28", "Check floor cleaning schedule and warning signs.");
  fullInvestigation(v2, "investigator2", "2026-08-22", "2026-08-23", "2026-08-25", "2026-08-26",
    { findings: "The floor was mopped without a wet-floor sign.", witnesses: "Library assistant.", recommendation: "Use warning signs during cleaning." },
    { problem: "Student slipped.", cause: "Wet floor without warning.", evidence: "Cleaning log and witness statement.", immediate: "Wet floor.", root: "No procedure requiring warning signs.", factors: "Rain brought water inside.", prevent: "Wet-floor signs and entrance mats." });
  const a3 = action("2026-08-27", i2, "officer", "Preventive Action", "Place wet-floor signs and entrance mats.", "actionofficer2", "2026-09-05", "Medium");
  astep("2026-09-01", a3, "actionofficer2", "In Progress", ""); astep("2026-09-03", a3, "actionofficer2", "Completed", "Signs and mats installed."); astep("2026-09-04", a3, "supervisor", "Verified", "");
  on("2026-09-05", () => recordResolution({ incident_id: i2.incident_id, resolution_type: "Preventive Measures Implemented", description: "Signs and mats installed.", resolution_date: "2026-09-05", remarks: "" }, U("supervisor")));
  on("2026-09-06", () => closeIncident(i2.incident_id, true, "", U("supervisor")));

  // 3. Resolved, waiting for closure
  const i3 = incident("2026-09-03", "Pedro Lim", "Security", "Theft", "Canteen", "Medium", "12:40", "A visitor reported a stolen bag left on a canteen table.", "Security guard checked the CCTV.");
  const v3 = assign("2026-09-04", i3, "investigator", "2026-09-04", "2026-09-11", "Review CCTV footage.");
  fullInvestigation(v3, "investigator", "2026-09-05", "2026-09-06", "2026-09-08", "2026-09-09",
    { findings: "CCTV showed an unidentified person taking the bag. The canteen camera had a blind spot.", witnesses: "Canteen cashier.", recommendation: "Add a camera and lockers." },
    { problem: "A bag was stolen.", cause: "Unattended bag, blind spot in CCTV.", evidence: "CCTV footage.", immediate: "Unattended bag.", root: "Insufficient CCTV coverage of the canteen.", factors: "Crowded lunch hour.", prevent: "Add a camera and put up reminder signs." });
  const a4 = action("2026-09-10", i3, "officer", "Policy Improvement", "Install an extra CCTV camera and post 'watch your belongings' signs.", "actionofficer", "2026-09-20", "Medium");
  astep("2026-09-14", a4, "actionofficer", "In Progress", ""); astep("2026-09-18", a4, "actionofficer", "Completed", "Camera installed."); astep("2026-09-19", a4, "supervisor", "Verified", "");
  on("2026-09-21", () => recordResolution({ incident_id: i3.incident_id, resolution_type: "Corrective Action Implemented", description: "Camera installed, signs posted.", resolution_date: "2026-09-21", remarks: "" }, U("officer")));

  // 4. For action, one overdue action
  const i4 = incident("2026-09-10", "Mark Santos", "Safety", "Fire", "Room 101", "High", "16:05", "Small fire from an overloaded extension cord in Room 101.", "Fire extinguisher used; building evacuated.");
  const v4 = assign("2026-09-11", i4, "investigator2", "2026-09-11", "2026-09-15", "Inspect wiring of the office.");
  fullInvestigation(v4, "investigator2", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-14",
    { findings: "Too many devices were connected to one extension cord.", witnesses: "Office staff.", recommendation: "Add outlets and limit extension cords." },
    { problem: "Small office fire.", cause: "Overloaded extension cord.", evidence: "Burnt cord, wiring inspection.", immediate: "Overloaded cord.", root: "Not enough electrical outlets in the office.", factors: "More computers added over time.", prevent: "Install more outlets; ban daisy-chained cords." });
  const a5 = action("2026-09-16", i4, "supervisor", "Safety Improvement", "Install additional wall outlets in Room 101.", "actionofficer", "2026-09-30", "High");
  const a6 = action("2026-09-16", i4, "supervisor", "Training", "Fire safety drill for the administration staff.", "actionofficer2", "2026-10-20", "Medium");
  astep("2026-10-05", a6, "actionofficer2", "In Progress", "");

  // 5. Under investigation, overdue
  const i5 = incident("2026-09-18", "Juan Dela Cruz", "Security", "Unauthorized Access", "IT Laboratory 2", "High", "21:10", "An unknown person was seen inside IT Laboratory 2 after closing time.", "Guard was informed; door lock checked.");
  const v5 = assign("2026-09-19", i5, "investigator", "2026-09-19", "2026-10-01", "Check door logs and key control.");
  step("2026-09-21", v5, "investigator", "In Progress");

  // 6. Just assigned
  const i6 = incident("2026-09-25", "Liza Cruz", "Safety", "Equipment Failure", "Main Reading Area", "Low", "09:20", "The library self-service scanner stopped working and smoked briefly.", "Scanner unplugged.");
  assign("2026-09-26", i6, "investigator2", "2026-09-26", "2026-10-15", "Inspect the scanner and its power supply.");

  // 7-10 newly reported
  incident("2026-10-01", "Grace Tan", "Accident", "Vehicle Accident", "Main Gate", "Medium", "07:45", "Two vehicles lightly collided at the main gate during the morning rush.", "Traffic was redirected by the guard.");
  incident("2026-10-05", "Liza Cruz", "IT/Technical", "Data Incident", "Room 101", "High", "11:30", "Student records spreadsheet was sent to the wrong email address.", "Recipient was asked to delete the file.");
  incident("2026-10-07", "Ana Reyes", "Health", "Physical Injury", "Gymnasium", "High", "15:50", "A student sprained an ankle during a basketball practice.", "Ice applied; student sent home with a guardian.");
  incident("2026-10-08", "Juan Dela Cruz", "Safety", "Slip/Fall", "IT Laboratory 2", "Low", "13:00", "A staff member tripped over a loose network cable.", "Cable was taped down.");

  fakeToday = null;
  db.tests = typeof defaultTests === "function" ? defaultTests() : [];
  db.audit.forEach(a => { /* sample audit rows keep their faked dates */ });
  save();
}
