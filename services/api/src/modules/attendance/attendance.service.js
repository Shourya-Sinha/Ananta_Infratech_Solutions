Object.defineProperty(exports, "__esModule", {
  value: true
});
var _Attendance = require("../../db/models/Attendance");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _Site = require("../../db/models/Site");
var _salary = require("../salary/salary.service");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _gateway = require("../../sockets/gateway");
var _sharedTypes = require("@ananta/shared-types");
function normalizeDate(dateStr) {
  // Store attendance dates at UTC midnight so "one record per worker per day" is unambiguous.
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
exports.AttendanceService = {
  /**
   * Full flow per spec §20/§44:
   * 1. validate permission (done by RBAC middleware upstream)
   * 2. validate manager actually manages this site (record-level scope check)
   * 3. save attendance
   * 4. run salary calculation engine
   * 5. update salary ledger
   * 6. recalculate monthly rollup
   * 7. emit socket events
   * 8. (notification emission happens in the caller for bulk-friendliness)
   */
  async record(input, actorId, actorRole) {
    const [profile, site] = await Promise.all([_WorkerProfile.WorkerProfile.findById(input.worker), _Site.Site.findById(input.site)]);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    if (!site) throw _AppError.AppError.notFound("Site not found");
    if (profile.verificationStatus !== "ACTIVE") {
      throw _AppError.AppError.validation("Attendance can only be recorded for ACTIVE (verified) workers.");
    }
    if (actorRole === "MANAGER" && site.manager?.toString() !== actorId) {
      throw _AppError.AppError.forbidden("You don't manage this site.");
    }
    const date = normalizeDate(input.date);
    const existing = await _Attendance.Attendance.findOne({
      worker: profile._id,
      date,
      correctionOf: null
    });
    if (existing) {
      if (existing.locked) {
        throw new _AppError.AppError("PAYROLL_LOCKED", "This attendance record's payroll month is finalized. Submit a correction instead.", 409);
      }
      throw _AppError.AppError.conflict("Attendance already recorded for this worker on this date. Use the correction endpoint to edit it.");
    }
    const attendance = await _Attendance.Attendance.create({
      worker: profile._id,
      site: site._id,
      date,
      status: input.status,
      hoursWorked: input.hoursWorked,
      overtimeHours: input.overtimeHours,
      recordedBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "ATTENDANCE_CREATED",
      targetType: "Attendance",
      targetId: attendance._id.toString(),
      after: {
        status: input.status,
        hoursWorked: input.hoursWorked,
        overtimeHours: input.overtimeHours
      }
    });
    const salaryResult = await _salary.SalaryService.postDailyEarning(attendance, actorId);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (salaryResult.posted) {
      await _salary.SalaryService.recalculateMonth(profile._id.toString(), month);
    }
    const io = (0, _gateway.getIO)();
    io.to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(site._id.toString())).to(_sharedTypes.ROOMS.worker(profile._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.ATTENDANCE_CREATED, {
      attendanceId: attendance._id.toString(),
      workerId: profile._id.toString(),
      siteId: site._id.toString(),
      status: attendance.status
    });
    if (salaryResult.posted) {
      io.to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(profile._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.SALARY_LEDGER_UPDATED, {
        workerId: profile._id.toString(),
        month
      });
    }
    return {
      attendance,
      salaryResult
    };
  },
  async bulkRecord(input, actorId, actorRole) {
    const results = [];
    for (const entry of input.entries) {
      try {
        const result = await this.record({
          ...entry,
          site: input.site,
          date: input.date
        }, actorId, actorRole);
        results.push({
          worker: entry.worker,
          success: true,
          attendanceId: result.attendance._id.toString()
        });
      } catch (err) {
        results.push({
          worker: entry.worker,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }
    return results;
  },
  /**
   * Correction after lock (§11 of spec): never edits in place, creates a new
   * record referencing correctionOf, requires elevated permission (checked
   * by RBAC middleware), and re-runs salary calculation.
   */
  async correct(params, actorId) {
    const original = await _Attendance.Attendance.findById(params.correctionOf);
    if (!original) throw _AppError.AppError.notFound("Original attendance record not found");
    const correction = await _Attendance.Attendance.create({
      worker: original.worker,
      site: original.site,
      date: original.date,
      status: params.status,
      hoursWorked: params.hoursWorked,
      overtimeHours: params.overtimeHours,
      recordedBy: actorId,
      correctionOf: original._id
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "ATTENDANCE_CORRECTED",
      targetType: "Attendance",
      targetId: correction._id.toString(),
      before: {
        status: original.status,
        hoursWorked: original.hoursWorked
      },
      after: {
        status: params.status,
        hoursWorked: params.hoursWorked,
        reason: params.reason
      }
    });
    const salaryResult = await _salary.SalaryService.postDailyEarning(correction, actorId);
    const date = original.date;
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (salaryResult.posted) {
      // Re-finalization guard lives inside recalculateMonth; a FINALIZED
      // month requires an explicit adjustment entry via the payroll module,
      // not a silent recalculation (§43 of spec).
      await _salary.SalaryService.recalculateMonth(original.worker.toString(), month).catch(() => {

        /* if month is finalized/paid, the ledger entry still stands as an audit trail */});
    }
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(original.site.toString())).to(_sharedTypes.ROOMS.worker(original.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.ATTENDANCE_UPDATED, {
      attendanceId: correction._id.toString()
    });
    return correction;
  },
  async list(filter) {
    const query = {};
    if (filter.site) query.site = filter.site;
    if (filter.worker) query.worker = filter.worker;
    if (filter.from || filter.to) {
      query.date = {};
      if (filter.from) query.date.$gte = normalizeDate(filter.from);
      if (filter.to) query.date.$lte = normalizeDate(filter.to);
    }
    return _Attendance.Attendance.find(query).populate("worker", "employeeId").populate("site", "name code").sort({
      date: -1
    });
  }
};