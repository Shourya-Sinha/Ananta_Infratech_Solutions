Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calculateDailyEarning = calculateDailyEarning;
exports.calculateNetSalary = calculateNetSalary;
exports.deriveSalaryRates = deriveSalaryRates;
exports.expectedMonthlyGrossPaise = expectedMonthlyGrossPaise;
exports.projectMonthlySalary = projectMonthlySalary;
Object.defineProperty(exports, "multiplyPaiseByFactor", {
  enumerable: true,
  get: function () {
    return _money.multiplyPaiseByFactor;
  }
});
var _money = require("./money");
/**
 * Pure calculation, no DB/IO. This is the function unit-tested against every
 * example in the spec (§42, §50): 0h, 2h, 4h, 8h, 9h, 10h, 15h.
 *
 * hourlyRate = dailyRate / fullDayHours
 * regular earning = hourlyRate * min(hoursWorked, overtimeStartHours)
 * overtime earning = hourlyRate * overtimeMultiplier * max(0, hoursWorked - overtimeStartHours)
 */
function calculateDailyEarning(input) {
  const {
    dailyRatePaise,
    hoursWorked,
    rules
  } = input;
  if (hoursWorked < 0) {
    throw new Error("calculateDailyEarning: hoursWorked cannot be negative");
  }
  if (rules.fullDayHours <= 0) {
    throw new Error("calculateDailyEarning: fullDayHours must be > 0");
  }

  // hourly rate as a real number derived from integer paise; only used as a
  // multiplication factor, never stored — the result is rounded back to integer paise.
  const hourlyRatePaiseExact = dailyRatePaise / rules.fullDayHours;
  const regularHours = Math.min(hoursWorked, rules.overtimeStartHours);
  const overtimeHours = Math.max(0, hoursWorked - rules.overtimeStartHours);
  const regularEarningPaise = Math.round(hourlyRatePaiseExact * regularHours);
  const overtimeEarningPaise = Math.round(hourlyRatePaiseExact * rules.overtimeMultiplier * overtimeHours);
  return {
    regularHours,
    overtimeHours,
    hourlyRatePaise: Math.round(hourlyRatePaiseExact),
    regularEarningPaise,
    overtimeEarningPaise,
    totalEarningPaise: (0, _money.addPaise)(regularEarningPaise, overtimeEarningPaise)
  };
}
/**
 * Salary-rate conversion — the single source of truth for
 * hourly ⇄ daily ⇄ monthly, used by the API, admin web and mobile.
 *
 * Admin/Manager may set a worker's pay in ANY one basis; the other two are
 * always derived from it, never stored independently (stored copies drift):
 *   daily   = hourly × fullDayHours
 *   monthly = daily  × workingDaysPerMonth   (default 26)
 *   hourly  = monthly / workingDaysPerMonth / fullDayHours
 * All money stays integer paise; derivations round to the nearest paise.
 *
 * @param {{salaryMode?:string, hourlyRatePaise?:number, dailyRatePaise?:number,
 *          monthlySalaryPaise?:number, fallbackDailyRatePaise?:number}} rate
 *        fallbackDailyRatePaise = the work-type default, used when the worker
 *        has no individual rate set.
 * @param {{fullDayHours?:number, workingDaysPerMonth?:number}} rules
 */
function deriveSalaryRates(rate = {}, rules = {}) {
  const fullDayHours = Number(rules.fullDayHours) > 0 ? Number(rules.fullDayHours) : 8;
  const workingDaysPerMonth = Number(rules.workingDaysPerMonth) > 0 ? Number(rules.workingDaysPerMonth) : 26;
  const mode = ["HOURLY", "DAILY", "MONTHLY"].includes(rate.salaryMode) ? rate.salaryMode : null;
  let dailyRatePaise = null;
  let source = "NONE";
  if (mode === "HOURLY" && rate.hourlyRatePaise > 0) {
    dailyRatePaise = Math.round(rate.hourlyRatePaise * fullDayHours);
    source = "HOURLY";
  } else if (mode === "MONTHLY" && rate.monthlySalaryPaise > 0) {
    dailyRatePaise = Math.round(rate.monthlySalaryPaise / workingDaysPerMonth);
    source = "MONTHLY";
  } else if (rate.dailyRatePaise > 0) {
    dailyRatePaise = Math.round(rate.dailyRatePaise);
    source = mode === "DAILY" ? "DAILY" : "DAILY_FALLBACK";
  } else if (mode === "HOURLY" && rate.hourlyRatePaise > 0) {
    dailyRatePaise = Math.round(rate.hourlyRatePaise * fullDayHours);
    source = "HOURLY";
  } else if (mode === "MONTHLY" && rate.monthlySalaryPaise > 0) {
    dailyRatePaise = Math.round(rate.monthlySalaryPaise / workingDaysPerMonth);
    source = "MONTHLY";
  } else if (rate.fallbackDailyRatePaise > 0) {
    dailyRatePaise = Math.round(rate.fallbackDailyRatePaise);
    source = "WORK_TYPE_DEFAULT";
  }
  if (dailyRatePaise == null) {
    return { source: "NONE", fullDayHours, workingDaysPerMonth, hourlyRatePaise: 0, dailyRatePaise: 0, monthlySalaryPaise: 0 };
  }
  return {
    source,
    fullDayHours,
    workingDaysPerMonth,
    dailyRatePaise,
    hourlyRatePaise: Math.round(dailyRatePaise / fullDayHours),
    monthlySalaryPaise: Math.round(dailyRatePaise * workingDaysPerMonth)
  };
}

/**
 * Live current-month salary projection for the Worker page salary box.
 *
 * At registration (no attendance yet) this equals the full-month estimate:
 * per-day wage x working days (default 26). As attendance is recorded, each
 * marked day is treated as elapsed, whether PRESENT, absent, reduced-hours,
 * HALF_DAY or leave; future unmarked working days are still expected at the
 * full daily rate. Therefore:
 * - absent / unpaid leave reduces the box by one daily wage;
 * - a 2-hour day reduces it by (daily wage - 2 hours of earnings);
 * - a 6-hour day reduces it by (daily wage - 6 hours of earnings);
 * - paid advance / Kharchi / other deductions reduce take-home;
 * - requested-but-unpaid amounts are reported separately as pending.
 */
function projectMonthlySalary(input = {}) {
  const workingDaysPerMonth = Number(input.workingDaysPerMonth) > 0 ? Number(input.workingDaysPerMonth) : 26;
  const dailyRatePaise = Math.max(0, Number(input.dailyRatePaise) || 0);
  const totalEarningsPaise = Math.max(0, Number(input.totalEarningsPaise) || 0);
  const elapsedDays = Math.max(0, Number(input.elapsedDays) || 0);
  const remainingDays = Math.max(0, workingDaysPerMonth - elapsedDays);
  const expectedRemainingEarningsPaise = Math.round(dailyRatePaise * remainingDays);
  const projectedGrossPaise = (0, _money.addPaise)(totalEarningsPaise, expectedRemainingEarningsPaise);
  const paidDeductionsPaise = (0, _money.addPaise)(input.advanceDeductionsPaise || 0, input.kharchiDeductionsPaise || 0, input.otherDeductionsPaise || 0);
  const pendingDeductionsPaise = (0, _money.addPaise)(input.pendingAdvancePaise || 0, input.pendingKharchiPaise || 0);
  const projectedNetPaise = Math.max(0, projectedGrossPaise - paidDeductionsPaise);
  return {
    workingDaysPerMonth,
    elapsedDays,
    remainingDays,
    expectedRemainingEarningsPaise,
    projectedGrossPaise,
    paidDeductionsPaise,
    pendingDeductionsPaise,
    projectedNetPaise,
    projectedNetAfterPendingPaise: Math.max(0, projectedNetPaise - pendingDeductionsPaise)
  };
}

/** Expected gross for a full month at the derived daily rate. */
function expectedMonthlyGrossPaise(rates) {
  return rates && rates.dailyRatePaise > 0 ? Math.round(rates.dailyRatePaise * (rates.workingDaysPerMonth || 26)) : 0;
}

function calculateNetSalary(input) {
  const gross = (0, _money.addPaise)(input.grossEarningsPaise, input.overtimeEarningsPaise);
  const deductions = (0, _money.addPaise)(input.advanceDeductionsPaise, input.kharchiDeductionsPaise, input.otherDeductionsPaise);
  return gross - deductions;
}

// re-exported for convenience so callers only need one import