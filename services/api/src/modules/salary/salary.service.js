Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _SalaryLedger = require("../../db/models/SalaryLedger");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _MonthlyPayroll = require("../../db/models/MonthlyPayroll");
var _Attendance = require("../../db/models/Attendance");
var _salaryRule = require("./salaryRule.service");
var _utils = require("@ananta/utils");
var _statement = require("./statement");
var _Requests = require("../../db/models/Requests");
var _AppError = require("../../errors/AppError");
function toPaiseNumber(decimal) {
  return Number(decimal.toString());
}
async function getLastRunningBalance(workerId) {
  const last = await _SalaryLedger.SalaryLedger.findOne({
    worker: workerId
  }).sort({
    createdAt: -1
  });
  return last ? toPaiseNumber(last.runningBalancePaise) : 0;
}
exports.SalaryService = {
  /**
   * Called immediately after an Attendance record is created/updated.
   * Computes the day's earning via the pure calculation engine, appends a
   * ledger entry (EARNING + separate OVERTIME line for auditability), and
   * returns both so the caller can emit realtime events.
   */
  async postDailyEarning(attendance, actorId) {
    const profile = await _WorkerProfile.WorkerProfile.findById(attendance.worker).populate("workType");
    if (!profile) throw _AppError.AppError.notFound("Worker not found for attendance record");
    const workType = profile.workType;
    if (!workType) throw _AppError.AppError.validation("Worker has no work type set; cannot calculate salary.");
    if (attendance.status === "ABSENT" || attendance.status === "LEAVE_UNPAID") {
      // No earning posted for absent/unpaid-leave days.
      return {
        posted: false
      };
    }
    const rules = await _salaryRule.SalaryRuleService.getActiveRuleSet();
    // Per-worker rate wins over the work-type default. The admin/manager may
    // have set it per-hour, per-day or per-month — deriveSalaryRates converts
    // all three bases to the one daily rate the engine needs.
    const rates = (0, _utils.deriveSalaryRates)({
      salaryMode: profile.salaryMode,
      hourlyRatePaise: profile.hourlyRatePaise,
      dailyRatePaise: profile.dailyRatePaise,
      monthlySalaryPaise: profile.monthlySalaryPaise,
      fallbackDailyRatePaise: workType.defaultDailyRatePaise
    }, rules);
    if (!rates.dailyRatePaise) throw _AppError.AppError.validation("No salary rate set for this worker or their work type.");
    // Hours actually worked. A PRESENT mark with no hours recorded means a
    // full day (managers often just tap "present") and HALF_DAY with no
    // hours means half a day — previously both silently earned ₹0.
    let workedHours = (attendance.hoursWorked ?? 0) + (attendance.overtimeHours ?? 0);
    if (attendance.status === "LEAVE_PAID") workedHours = rules.fullDayHours; // paid leave credited as a full day
    else if (attendance.status === "PRESENT" && workedHours === 0) workedHours = rules.fullDayHours;
    else if (attendance.status === "HALF_DAY" && workedHours === 0) workedHours = rules.fullDayHours / 2;
    const totalHours = workedHours;
    const result = (0, _utils.calculateDailyEarning)({
      dailyRatePaise: rates.dailyRatePaise,
      hoursWorked: totalHours,
      rules
    });
    result.salaryRates = rates;
    const entries = [{
      type: "EARNING",
      amount: result.regularEarningPaise,
      description: `Regular earning — ${attendance.status} — ${result.regularHours}h`
    }];
    if (result.overtimeEarningPaise > 0) {
      entries.push({
        type: "OVERTIME",
        amount: result.overtimeEarningPaise,
        description: `Overtime earning — ${result.overtimeHours}h`
      });
    }
    let runningBalance = await getLastRunningBalance(profile._id);
    const createdEntries = [];
    for (const entry of entries) {
      runningBalance = (0, _utils.addPaise)(runningBalance, entry.amount);
      const ledgerEntry = await _SalaryLedger.SalaryLedger.create({
        worker: profile._id,
        site: attendance.site,
        date: attendance.date,
        type: entry.type,
        description: entry.description,
        creditPaise: entry.amount.toString(),
        debitPaise: "0",
        runningBalancePaise: runningBalance.toString(),
        reference: attendance._id.toString(),
        createdBy: actorId
      });
      createdEntries.push(ledgerEntry);
    }
    return {
      posted: true,
      entries: createdEntries,
      calculation: result
    };
  },
  /**
   * Posts a deduction (advance or kharchi payout) to the ledger. Called only
   * when a request transitions to PAID/APPROVED per the payroll rules —
   * never at request-creation time (§13/§14 of spec).
   */
  /**
   * REVERSAL of the ledger earnings posted for one attendance record
   * (matched by ledger.reference = attendance id). Used when an attendance
   * record is edited (correction) or deleted, so the month rollup never
   * double-counts the replaced day's earning. Each reversal is a REVERSAL
   * entry whose debit equals the still-unreversed part of the original
   * credit — original entries stay in the ledger as an audit trail, and
   * already-reversed amounts are never reversed twice.
   */
  async reverseEarningsForAttendance(attendanceId, params) {
    const related = await _SalaryLedger.SalaryLedger.find({
      reference: attendanceId.toString(),
      type: {
        $in: ["EARNING", "OVERTIME", "REVERSAL"]
      }
    }).sort({
      createdAt: 1
    });
    // Amount already reversed by earlier corrections/deletions of this record.
    let reversedBudget = 0;
    for (const entry of related) {
      if (entry.type === "REVERSAL") reversedBudget += toPaiseNumber(entry.debitPaise);
    }
    const created = [];
    for (const entry of related) {
      if (entry.type === "REVERSAL") continue;
      const credit = toPaiseNumber(entry.creditPaise);
      const alreadyReversed = Math.min(reversedBudget, credit);
      reversedBudget -= alreadyReversed;
      const outstanding = credit - alreadyReversed;
      if (outstanding <= 0) continue;
      const runningBalance = await getLastRunningBalance(entry.worker);
      const reversal = await _SalaryLedger.SalaryLedger.create({
        worker: entry.worker,
        site: entry.site,
        date: entry.date,
        type: "REVERSAL",
        description: params?.description ?? `Reversal of ${entry.type.toLowerCase()} for deleted/edited attendance`,
        creditPaise: "0",
        debitPaise: outstanding.toString(),
        // BUG FIX: this previously stored the PRE-reversal balance, so the
        // worker's running balance never went down after a correction/delete
        // even though the month rollup did — ledger and payroll disagreed.
        runningBalancePaise: (runningBalance - outstanding).toString(),
        reference: entry.reference,
        createdBy: params?.actorId ?? entry.createdBy
      });
      created.push(reversal);
    }
    return created;
  },
  /**
   * Attendance day counts for one worker + "YYYY-MM" — shown on the payroll
   * sheet so every amount can be traced back to days/hours worked.
   */
  async getAttendanceSummary(workerId, month) {
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const counts = await _Attendance.Attendance.aggregate([{
      $match: {
        worker: new _mongoose.Types.ObjectId(workerId),
        date: {
          $gte: new Date(Date.UTC(year, monthIndex, 1)),
          $lte: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59))
        }
      }
    }, {
      $group: {
        _id: "$status",
        count: {
          $sum: 1
        },
        overtimeHours: {
          $sum: "$overtimeHours"
        }
      }
    }]);
    const summary = {
      presentDays: 0,
      halfDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      absentDays: 0,
      customDays: 0,
      markedDays: 0,
      overtimeHours: 0
    };
    for (const row of counts) {
      summary.markedDays += row.count;
      // hours can be fractional (e.g. 1.5) — round to one decimal, never float-drift
      summary.overtimeHours = Math.round((summary.overtimeHours + (row.overtimeHours ?? 0)) * 10) / 10;
      switch (row._id) {
        case "PRESENT":
          summary.presentDays += row.count;
          break;
        case "HALF_DAY":
          summary.halfDays += row.count;
          break;
        case "LEAVE_PAID":
          summary.paidLeaveDays += row.count;
          break;
        case "LEAVE_UNPAID":
          summary.unpaidLeaveDays += row.count;
          break;
        case "ABSENT":
          summary.absentDays += row.count;
          break;
        default:
          summary.customDays += row.count;
      }
    }
    return summary;
  },
  async postDeduction(params) {
    const workerObjectId = new _mongoose.Types.ObjectId(params.workerId);
    // Idempotency: one deduction per source request. A retried approve/pay
    // call (double tap, network retry) must never deduct the same advance
    // or Kharchi twice from the worker's salary.
    if (params.reference) {
      const existing = await _SalaryLedger.SalaryLedger.findOne({
        reference: params.reference,
        type: params.type
      });
      if (existing) return existing;
    }
    let deductionDate = params.date ? new Date(params.date) : new Date();
    // Month attribution: a deduction belongs to the month it is PAID in.
    // If the target month's payroll is already FINALIZED/PAID, posting there
    // would silently change a locked month (the rollup refuses to recalc) —
    // carry the deduction into the current, still-open month instead.
    const targetMonth = `${deductionDate.getUTCFullYear()}-${String(deductionDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const lockedPayroll = await _MonthlyPayroll.MonthlyPayroll.findOne({
      worker: workerObjectId,
      month: targetMonth,
      status: {
        $in: ["FINALIZED", "PAID"]
      }
    }).select("_id");
    if (lockedPayroll) deductionDate = new Date();
    let runningBalance = await getLastRunningBalance(workerObjectId);
    runningBalance -= params.amountPaise;
    return _SalaryLedger.SalaryLedger.create({
      worker: workerObjectId,
      site: params.siteId,
      date: deductionDate,
      type: params.type,
      description: params.description,
      creditPaise: "0",
      debitPaise: params.amountPaise.toString(),
      runningBalancePaise: runningBalance.toString(),
      reference: params.reference,
      createdBy: params.actorId
    }).then(async (entry) => {
      // Keep the monthly rollup in step with the live ledger so Admin
      // payroll, worker statement and site finance never tell three
      // different stories. Failure (e.g. month just finalized) must not
      // fail the deduction itself — calculateMonth can rebuild it later.
      const m = `${deductionDate.getUTCFullYear()}-${String(deductionDate.getUTCMonth() + 1).padStart(2, "0")}`;
      await exports.SalaryService.recalculateMonth(workerObjectId.toString(), m).catch(() => {});
      return entry;
    });
  },
  /**
   * Salary preview for worker / manager / admin: the worker's derived rates,
   * what they earned TODAY, what they have earned this month so far, and the
   * approximate full-month salary if they work the remaining working days.
   * expectedMonthlyNet uses deductions posted so far (pending requests are
   * reported separately, matching the live statement).
   */
  async getSalaryPreview(workerId, month) {
    const profile = await _WorkerProfile.WorkerProfile.findById(workerId).populate("workType");
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    const rules = await _salaryRule.SalaryRuleService.getActiveRuleSet();
    const rates = (0, _utils.deriveSalaryRates)({
      salaryMode: profile.salaryMode,
      hourlyRatePaise: profile.hourlyRatePaise,
      dailyRatePaise: profile.dailyRatePaise,
      monthlySalaryPaise: profile.monthlySalaryPaise,
      fallbackDailyRatePaise: profile.workType?.defaultDailyRatePaise
    }, rules);
    const statement = await this.getStatement(workerId, month);
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = statement.daily.find((d) => d.date === todayKey);
    const workedDays = statement.attendance.presentDays + statement.attendance.paidLeaveDays + statement.attendance.halfDays * 0.5;
    const remainingDays = Math.max(0, rates.workingDaysPerMonth - workedDays);
    const expectedGrossPaise = (0, _utils.expectedMonthlyGrossPaise)(rates);
    const projectedGrossPaise = statement.totals.totalEarningsPaise + Math.round(rates.dailyRatePaise * remainingDays);
    // For a MONTHLY-salaried worker the full-month expectation is the fixed
    // monthly salary itself; for hourly/daily it is rate × working days.
    const approximateMonthlyGrossPaise = profile.salaryMode === "MONTHLY" && profile.monthlySalaryPaise > 0 ? profile.monthlySalaryPaise : expectedGrossPaise;
    return {
      workerId: workerId.toString(),
      month,
      rates: {
        mode: profile.salaryMode ?? (rates.source === "WORK_TYPE_DEFAULT" ? "WORK_TYPE_DEFAULT" : "DAILY"),
        source: rates.source,
        hourlyRatePaise: rates.hourlyRatePaise,
        dailyRatePaise: rates.dailyRatePaise,
        monthlySalaryPaise: rates.monthlySalaryPaise,
        fullDayHours: rates.fullDayHours,
        workingDaysPerMonth: rates.workingDaysPerMonth
      },
      today: {
        date: todayKey,
        earnedPaise: today?.earningsPaise ?? 0,
        deductionsPaise: today?.deductionsPaise ?? 0,
        netPaise: today?.netPaise ?? 0
      },
      monthSoFar: statement.totals,
      attendance: statement.attendance,
      approximateMonthlyGrossPaise,
      projectedGrossPaise,
      approximateMonthlyNetPaise: Math.max(0, (profile.salaryMode === "MONTHLY" ? approximateMonthlyGrossPaise : projectedGrossPaise) - statement.totals.advanceDeductionsPaise - statement.totals.kharchiDeductionsPaise - statement.totals.otherDeductionsPaise),
      pending: statement.pending,
      payrollStatus: statement.payrollStatus
    };
  },
  /**
   * Sets a worker's individual pay rate from ONE basis (hourly, daily or
   * monthly rupees). Only the chosen basis is stored; the other two are
   * derived on every read. Past ledger entries are NOT rewritten.
   */
  async setWorkerSalaryRate(workerId, input, actorId) {
    const profile = await _WorkerProfile.WorkerProfile.findById(workerId);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    profile.salaryMode = input.mode;
    profile.hourlyRatePaise = input.mode === "HOURLY" ? (0, _utils.rupeesToPaise)(input.amountRupees) : undefined;
    profile.dailyRatePaise = input.mode === "DAILY" ? (0, _utils.rupeesToPaise)(input.amountRupees) : undefined;
    profile.monthlySalaryPaise = input.mode === "MONTHLY" ? (0, _utils.rupeesToPaise)(input.amountRupees) : undefined;
    profile.salaryRateUpdatedBy = actorId;
    profile.salaryRateUpdatedAt = new Date();
    await profile.save();
    const rules = await _salaryRule.SalaryRuleService.getActiveRuleSet();
    return (0, _utils.deriveSalaryRates)({
      salaryMode: profile.salaryMode,
      hourlyRatePaise: profile.hourlyRatePaise,
      dailyRatePaise: profile.dailyRatePaise,
      monthlySalaryPaise: profile.monthlySalaryPaise
    }, rules);
  },
  async getLedger(workerId, from, to) {
    const query = {
      worker: workerId
    };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }
    return _SalaryLedger.SalaryLedger.find(query).sort({
      date: 1,
      createdAt: 1
    });
  },
  /**
   * Live salary statement for one worker and calendar month. Unlike the
   * payroll summary this does NOT require payroll to be calculated — it reads
   * the ledger directly, so every advance/kharchi that is paid or approved
   * is reflected the moment it is posted.
   */
  async getStatement(workerId, month) {
    const {
      from,
      to
    } = (0, _statement.monthBounds)(month);
    const rows = await _SalaryLedger.SalaryLedger.find({
      worker: workerId,
      date: {
        $gte: from,
        $lte: to
      }
    }).sort({
      date: 1,
      createdAt: 1
    });
    const entries = rows.map(e => ({
      id: e._id.toString(),
      date: e.date,
      type: e.type,
      description: e.description,
      creditPaise: toPaiseNumber(e.creditPaise),
      debitPaise: toPaiseNumber(e.debitPaise),
      runningBalancePaise: e.runningBalancePaise == null ? null : toPaiseNumber(e.runningBalancePaise)
    }));
    const [attendance, payroll, advances, kharchi] = await Promise.all([this.getAttendanceSummary(workerId, month), _MonthlyPayroll.MonthlyPayroll.findOne({
      worker: workerId,
      month
    }).select("status"), _Requests.AdvanceRequest.find({
      worker: workerId,
      status: {
        $in: ["REQUESTED", "APPROVED"]
      }
    }).select("amountPaise approvedAmountPaise"), _Requests.KharchiRequest.find({
      worker: workerId,
      status: "REQUESTED"
    }).select("amountPaise")]);
    const pendingAdvancePaise = advances.reduce((sum, a) => sum + (a.approvedAmountPaise ?? toPaiseNumber(a.amountPaise)), 0);
    const pendingKharchiPaise = kharchi.reduce((sum, k) => sum + toPaiseNumber(k.amountPaise), 0);
    return (0, _statement.buildStatement)({
      month,
      entries,
      attendance,
      pendingAdvancePaise,
      pendingKharchiPaise,
      payrollStatus: payroll?.status ?? null
    });
  },
  /**
   * Recomputes (idempotently — safe to re-run) the monthly rollup from raw
   * ledger entries for a given "YYYY-MM" month, and upserts MonthlyPayroll.
   * This is what §20/§44 call "salary recalculated" after every attendance change.
   */
  async recalculateMonth(workerId, month) {
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const from = new Date(Date.UTC(year, monthIndex, 1));
    const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59));
    const entries = await _SalaryLedger.SalaryLedger.find({
      worker: workerId,
      date: {
        $gte: from,
        $lte: to
      }
    });
    let grossEarningsPaise = 0;
    let overtimeEarningsPaise = 0;
    let advanceDeductionsPaise = 0;
    let kharchiDeductionsPaise = 0;
    let otherDeductionsPaise = 0;
    for (const e of entries) {
      const credit = toPaiseNumber(e.creditPaise);
      const debit = toPaiseNumber(e.debitPaise);
      switch (e.type) {
        case "EARNING":
          grossEarningsPaise = (0, _utils.addPaise)(grossEarningsPaise, credit);
          break;
        case "OVERTIME":
          overtimeEarningsPaise = (0, _utils.addPaise)(overtimeEarningsPaise, credit);
          break;
        case "ADVANCE_DEDUCTION":
          advanceDeductionsPaise = (0, _utils.addPaise)(advanceDeductionsPaise, debit);
          break;
        case "KHARCHI_DEDUCTION":
          kharchiDeductionsPaise = (0, _utils.addPaise)(kharchiDeductionsPaise, debit);
          break;
        case "REVERSAL":
          // A reversal cancels an earning that was already counted in gross
          // (same attendance, corrected/deleted). Netting it against gross —
          // instead of inflating "other deductions" — keeps the payroll sheet
          // honest: gross shows what the CURRENT attendance actually earned.
          // The reversal's original split (regular vs OT) is not stored, so
          // it is netted from gross first, then overtime.
          {
            let remaining = Math.max(0, debit - credit);
            const fromGross = Math.min(grossEarningsPaise, remaining);
            grossEarningsPaise -= fromGross;
            remaining -= fromGross;
            overtimeEarningsPaise = Math.max(0, overtimeEarningsPaise - remaining);
          }
          break;
        case "ADJUSTMENT":
          otherDeductionsPaise = (0, _utils.addPaise)(otherDeductionsPaise, debit - credit >= 0 ? debit - credit : 0);
          break;
      }
    }
    const netSalaryPaise = (0, _utils.calculateNetSalary)({
      grossEarningsPaise,
      overtimeEarningsPaise,
      advanceDeductionsPaise,
      kharchiDeductionsPaise,
      otherDeductionsPaise
    });
    // Day counts come straight from the attendance records behind the
    // earnings, so every amount on the payroll sheet is traceable.
    const attendance = await this.getAttendanceSummary(workerId, month);
    const existing = await _MonthlyPayroll.MonthlyPayroll.findOne({
      worker: workerId,
      month
    });
    if (existing && existing.status === "FINALIZED") {
      throw _AppError.AppError.conflict(`Payroll for ${month} is already finalized. Post an adjustment entry instead of recalculating.`);
    }
    if (existing && existing.status === "PAID") {
      throw _AppError.AppError.conflict(`Payroll for ${month} has already been paid.`);
    }
    const payroll = await _MonthlyPayroll.MonthlyPayroll.findOneAndUpdate({
      worker: workerId,
      month
    }, {
      grossEarningsPaise,
      overtimeEarningsPaise,
      advanceDeductionsPaise,
      kharchiDeductionsPaise,
      otherDeductionsPaise,
      netSalaryPaise,
      presentDays: attendance.presentDays,
      halfDays: attendance.halfDays,
      paidLeaveDays: attendance.paidLeaveDays,
      unpaidLeaveDays: attendance.unpaidLeaveDays,
      absentDays: attendance.absentDays,
      overtimeHours: attendance.overtimeHours,
      status: "CALCULATED"
    }, {
      upsert: true,
      new: true
    });
    return payroll;
  }
};