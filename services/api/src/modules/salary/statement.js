Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildStatement = buildStatement;
exports.currentMonthIST = currentMonthIST;
exports.monthBounds = monthBounds;
var _utils = require("@ananta/utils");
/**
 * Pure salary-statement maths. No I/O here so it can be unit-tested and so
 * the live (pre-payroll) statement and the payroll rollup can never drift:
 * both sum the same ledger entry types with the same net formula.
 */

/** Calendar month "YYYY-MM" for the company's local timezone (IST). */
function currentMonthIST(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  return `${year}-${month}`;
}

/** UTC bounds for a month; matches how ledger dates are stored (day-level). */
function monthBounds(month) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59))
  };
}
function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * @param {object} input
 * @param {string} input.month  "YYYY-MM"
 * @param {Array<{id?:string,date:Date,type:string,description:string,creditPaise:number,debitPaise:number,runningBalancePaise?:number}>} input.entries
 *        ledger entries for the month, ascending by date
 * @param {{presentDays?:number,halfDays?:number,paidLeaveDays?:number,unpaidLeaveDays?:number,absentDays?:number,overtimeHours?:number}} input.attendance
 * @param {number} input.pendingAdvancePaise  requested/approved advances not yet paid out
 * @param {number} input.pendingKharchiPaise  kharchi requested but not yet approved
 * @param {string|null} input.payrollStatus   CALCULATED | FINALIZED | PAID, or null when not yet calculated
 */
function buildStatement({
  month,
  entries,
  attendance = {},
  pendingAdvancePaise = 0,
  pendingKharchiPaise = 0,
  payrollStatus = null
}) {
  let grossEarningsPaise = 0;
  let overtimeEarningsPaise = 0;
  let advanceDeductionsPaise = 0;
  let kharchiDeductionsPaise = 0;
  let otherDeductionsPaise = 0;
  const days = new Map();
  for (const e of entries) {
    const credit = Number(e.creditPaise) || 0;
    const debit = Number(e.debitPaise) || 0;
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

    // Day-by-day breakdown so the worker can see exactly what moved their pay.
    const key = dayKey(e.date);
    if (!days.has(key)) {
      days.set(key, {
        date: key,
        earningsPaise: 0,
        deductionsPaise: 0,
        netPaise: 0,
        entries: []
      });
    }
    const day = days.get(key);
    const signedNet = credit - debit;
    day.netPaise += signedNet;
    if (signedNet >= 0) day.earningsPaise += signedNet;else day.deductionsPaise += -signedNet;
    day.entries.push({
      id: e.id,
      type: e.type,
      description: e.description,
      direction: signedNet >= 0 ? "CREDIT" : "DEBIT",
      amountPaise: Math.abs(signedNet)
    });
  }
  const totalEarningsPaise = (0, _utils.addPaise)(grossEarningsPaise, overtimeEarningsPaise);
  const totalDeductionsPaise = (0, _utils.addPaise)(advanceDeductionsPaise, kharchiDeductionsPaise, otherDeductionsPaise);
  const netSalaryPaise = (0, _utils.calculateNetSalary)({
    grossEarningsPaise,
    overtimeEarningsPaise,
    advanceDeductionsPaise,
    kharchiDeductionsPaise,
    otherDeductionsPaise
  });
  const lastEntry = entries[entries.length - 1];
  return {
    month,
    payrollStatus: payrollStatus ?? "LIVE",
    totals: {
      grossEarningsPaise,
      overtimeEarningsPaise,
      totalEarningsPaise,
      advanceDeductionsPaise,
      kharchiDeductionsPaise,
      otherDeductionsPaise,
      totalDeductionsPaise,
      netSalaryPaise
    },
    // Requested but not yet deducted. Shown so the worker can see what is
    // still on its way; excluded from net until the money is actually paid.
    pending: {
      advancePaise: pendingAdvancePaise,
      kharchiPaise: pendingKharchiPaise
    },
    attendance: {
      presentDays: attendance.presentDays ?? 0,
      halfDays: attendance.halfDays ?? 0,
      paidLeaveDays: attendance.paidLeaveDays ?? 0,
      unpaidLeaveDays: attendance.unpaidLeaveDays ?? 0,
      absentDays: attendance.absentDays ?? 0,
      overtimeHours: attendance.overtimeHours ?? 0
    },
    balancePaise: lastEntry?.runningBalancePaise ?? null,
    daily: [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
  };
}
