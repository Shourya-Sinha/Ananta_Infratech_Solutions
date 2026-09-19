Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _SalaryLedger = require("../../db/models/SalaryLedger");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _MonthlyPayroll = require("../../db/models/MonthlyPayroll");
var _salaryRule = require("./salaryRule.service");
var _utils = require("@ananta/utils");
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
    const totalHours = attendance.status === "LEAVE_PAID" ? rules.fullDayHours // paid leave credited as a full day
    : (attendance.hoursWorked ?? 0) + (attendance.overtimeHours ?? 0);
    const result = (0, _utils.calculateDailyEarning)({
      dailyRatePaise: workType.defaultDailyRatePaise,
      hoursWorked: totalHours,
      rules
    });
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
  async postDeduction(params) {
    const workerObjectId = new _mongoose.Types.ObjectId(params.workerId);
    let runningBalance = await getLastRunningBalance(workerObjectId);
    runningBalance -= params.amountPaise;
    return _SalaryLedger.SalaryLedger.create({
      worker: workerObjectId,
      site: params.siteId,
      date: new Date(),
      type: params.type,
      description: params.description,
      creditPaise: "0",
      debitPaise: params.amountPaise.toString(),
      runningBalancePaise: runningBalance.toString(),
      reference: params.reference,
      createdBy: params.actorId
    });
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
        case "ADJUSTMENT":
        case "REVERSAL":
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
      status: "CALCULATED"
    }, {
      upsert: true,
      new: true
    });
    return payroll;
  }
};