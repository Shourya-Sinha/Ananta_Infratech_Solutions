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
    if (original.locked) {
      throw new _AppError.AppError("PAYROLL_LOCKED", "This attendance record's payroll month is finalized. Post a payroll adjustment instead.", 409);
    }
    // Reverse the ORIGINAL day's earning first so the corrected earning
    // doesn't double-count in the month rollup (the original ledger entries
    // stay as an audit trail; equal REVERSAL debits cancel them out).
    await _salary.SalaryService.reverseEarningsForAttendance(original._id.toString(), {
      actorId,
      description: `Reversal — attendance corrected (${params.reason})`
    });
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
    // Recalculate whenever the ledger changed — a correction that flips a day
    // to ABSENT posts no new earning but still posted a reversal above.
    await _salary.SalaryService.recalculateMonth(original.worker.toString(), month).catch(() => {

      /* if month is finalized/paid, the ledger entry still stands as an audit trail */});
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(original.site.toString())).to(_sharedTypes.ROOMS.worker(original.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.ATTENDANCE_UPDATED, {
      attendanceId: correction._id.toString(),
      originalAttendanceId: original._id.toString()
    });
    return {
      correction,
      reversedEntries: true,
      salaryResult
    };
  },
  /**
   * ADMIN DELETE: removes an attendance record entirely (e.g. marked by
   * mistake). The record's salary posting is reversed in the ledger first,
   * so the month rollup and every payroll figure stay correct. Blocked once
   * the payroll month is FINALIZED/PAID (records are locked) — the admin
   * must post an adjustment instead. The ledger keeps the full audit trail;
   * the per-day slot is freed so attendance can be marked again.
   */
  async remove(attendanceId, actorId) {
    const attendance = await _Attendance.Attendance.findById(attendanceId);
    if (!attendance) throw _AppError.AppError.notFound("Attendance record not found");
    if (attendance.locked) {
      throw new _AppError.AppError("PAYROLL_LOCKED", "This attendance record's payroll month is finalized. Delete is not allowed — post a payroll adjustment instead.", 409);
    }
    // Collect the full correction chain rooted at this record (the target
    // plus any records superseding it) so no stale row for the same day
    // survives with an already-reversed salary.
    const chainIds = [attendance._id];
    let frontier = [attendance._id];
    while (frontier.length > 0) {
      const descendants = await _Attendance.Attendance.find({
        correctionOf: {
          $in: frontier
        }
      });
      frontier = descendants.map((d) => d._id);
      chainIds.push(...frontier);
    }
    for (const id of chainIds) {
      if (String(id) === String(attendance._id)) continue;
      const chained = await _Attendance.Attendance.findById(id);
      if (chained?.locked) {
        throw new _AppError.AppError("PAYROLL_LOCKED", "This attendance record's payroll month is finalized. Delete is not allowed — post a payroll adjustment instead.", 409);
      }
    }
    const date = attendance.date;
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    // Reverse the salary posting once for the whole chain (the reversal
    // helper never reverses an amount twice).
    const reversals = [];
    for (const id of chainIds) {
      const posted = await _salary.SalaryService.reverseEarningsForAttendance(id.toString(), {
        actorId,
        description: `Reversal — attendance deleted (${attendance.status}, ${date.toISOString().slice(0, 10)})`
      });
      reversals.push(...posted);
    }
    await _Attendance.Attendance.deleteMany({
      _id: {
        $in: chainIds
      }
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "ATTENDANCE_DELETED",
      targetType: "Attendance",
      targetId: attendance._id.toString(),
      before: {
        worker: attendance.worker.toString(),
        site: attendance.site.toString(),
        date,
        status: attendance.status,
        hoursWorked: attendance.hoursWorked,
        overtimeHours: attendance.overtimeHours,
        deletedRecords: chainIds.length,
        reversedLedgerEntries: reversals.length
      }
    });
    // Safe: a locked record would have thrown above, so the month is still open.
    await _salary.SalaryService.recalculateMonth(attendance.worker.toString(), month).catch(() => {});
    const io = (0, _gateway.getIO)();
    io.to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(attendance.site.toString())).to(_sharedTypes.ROOMS.worker(attendance.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.ATTENDANCE_DELETED, {
      attendanceId: attendance._id.toString(),
      workerId: attendance.worker.toString(),
      siteId: attendance.site.toString(),
      month
    });
    if (reversals.length > 0) {
      io.to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(attendance.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.SALARY_LEDGER_UPDATED, {
        workerId: attendance.worker.toString(),
        month
      });
    }
    return {
      deleted: true,
      reversedLedgerEntries: reversals.length
    };
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
    // Populate the worker's name (nested through WorkerProfile.user) alongside
    // the employee id so admin views can show who each record belongs to.
    return _Attendance.Attendance.find(query).populate({
      path: "worker",
      select: "employeeId user",
      populate: {
        path: "user",
        select: "name"
      }
    }).populate("site", "name code").sort({
      date: -1
    });
  }
};