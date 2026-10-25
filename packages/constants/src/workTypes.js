"use strict";

/**
 * Standard construction-site work types (trades) with indicative India
 * daily-wage defaults (₹/day). These are seeded automatically on API
 * startup / `npm run seed` when missing — Admin can edit every rate, rename,
 * deactivate or add more from Admin Web → Work Types. Seeding only ever
 * INSERTS missing codes; it never overwrites an admin-edited rate.
 */
const DEFAULT_WORK_TYPES = [
  { name: "Mason (Raj Mistri)", code: "MASON", defaultDailyRate: 900 },
  { name: "Plaster Mason", code: "PLASTER_MASON", defaultDailyRate: 950 },
  { name: "Tiles Mason", code: "TILES_MASON", defaultDailyRate: 1000 },
  { name: "Marble / Granite Mason", code: "MARBLE_MASON", defaultDailyRate: 1100 },
  { name: "Mason Helper", code: "MASON_HELPER", defaultDailyRate: 550 },
  { name: "Helper (Unskilled Labour)", code: "HELPER", defaultDailyRate: 500 },
  { name: "Foreman", code: "FOREMAN", defaultDailyRate: 1300 },
  { name: "Site Supervisor", code: "SUPERVISOR", defaultDailyRate: 1200 },
  { name: "Carpenter", code: "CARPENTER", defaultDailyRate: 950 },
  { name: "Shuttering Carpenter", code: "SHUTTERING_CARPENTER", defaultDailyRate: 950 },
  { name: "Bar Bender / Steel Fixer", code: "BAR_BENDER", defaultDailyRate: 900 },
  { name: "Welder", code: "WELDER", defaultDailyRate: 1000 },
  { name: "Fitter", code: "FITTER", defaultDailyRate: 900 },
  { name: "Electrician", code: "ELECTRICIAN", defaultDailyRate: 950 },
  { name: "Electrician Helper", code: "ELECTRICIAN_HELPER", defaultDailyRate: 550 },
  { name: "Plumber", code: "PLUMBER", defaultDailyRate: 900 },
  { name: "Painter", code: "PAINTER", defaultDailyRate: 800 },
  { name: "POP / False Ceiling Worker", code: "POP_WORKER", defaultDailyRate: 950 },
  { name: "Waterproofing Worker", code: "WATERPROOFING", defaultDailyRate: 950 },
  { name: "Scaffolder", code: "SCAFFOLDER", defaultDailyRate: 800 },
  { name: "Rigger", code: "RIGGER", defaultDailyRate: 850 },
  { name: "Concrete / Mixer Operator", code: "MIXER_OPERATOR", defaultDailyRate: 850 },
  { name: "Excavator Operator", code: "EXCAVATOR_OPERATOR", defaultDailyRate: 1400 },
  { name: "JCB Operator", code: "JCB_OPERATOR", defaultDailyRate: 1300 },
  { name: "Crane Operator", code: "CRANE_OPERATOR", defaultDailyRate: 1500 },
  { name: "Driver", code: "DRIVER", defaultDailyRate: 900 },
  { name: "Surveyor", code: "SURVEYOR", defaultDailyRate: 1400 },
  { name: "Site Engineer", code: "SITE_ENGINEER", defaultDailyRate: 1500 },
  { name: "Store Keeper", code: "STORE_KEEPER", defaultDailyRate: 800 },
  { name: "Security Guard", code: "SECURITY_GUARD", defaultDailyRate: 600 }
];

exports.DEFAULT_WORK_TYPES = DEFAULT_WORK_TYPES;
