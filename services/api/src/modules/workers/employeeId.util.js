Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateEmployeeId = generateEmployeeId;
var _WorkerProfile = require("../../db/models/WorkerProfile");
/**
 * Generates employee IDs like AIS-2026-000123. Not perfectly race-proof under
 * extreme concurrency (two simultaneous registrations could theoretically
 * collide), but the unique index on employeeId in WorkerProfile guarantees
 * we never persist a duplicate — a collision throws and the caller retries.
 */
async function generateEmployeeId() {
  const year = new Date().getFullYear();
  const count = await _WorkerProfile.WorkerProfile.countDocuments({
    employeeId: {
      $regex: `^AIS-${year}-`
    }
  });
  const sequence = String(count + 1).padStart(6, "0");
  return `AIS-${year}-${sequence}`;
}