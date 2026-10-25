Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calculateDailyEarning = calculateDailyEarning;
exports.calculateNetSalary = calculateNetSalary;
exports.deriveSalaryRates = deriveSalaryRates;
exports.expectedMonthlyGrossPaise = expectedMonthlyGrossPaise;
exports.projectMonthlySalary = projectMonthlySalary;
exports.describeAttendanceDay = describeAttendanceDay;
exports.getSalaryPeriodSchedule = getSalaryPeriodSchedule;
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
 * Payable-period schedule for one salary month.
 *
 * A worker created/joined mid-month is not estimated for the whole month:
 * if they join on 24 Oct, their current-month period is 24 Oct..31 Oct
 * (8 calendar days), not 26 days and not 1..31 Oct. Days before today are
 * elapsed whether they were marked or not; a marked day is elapsed even if
 * it is today/a future correction. Unmarked days from today to month-end
 * are still earnable, so they remain in remainingDays.
 */
function getSalaryPeriodSchedule(input = {}) {
  const month = String(input.month || "");
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return { month, from: null, to: null, totalDays: 0, elapsedDays: 0, remainingDays: 0 };
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0));
  const toKey = (d) => d.toISOString().slice(0, 10);
  let from = monthStart;
  if (input.workerStartDate) {
    const start = new Date(input.workerStartDate);
    if (!Number.isNaN(start.getTime())) {
      const startKey = toKey(start);
      if (startKey > toKey(monthStart)) from = new Date(`${startKey}T00:00:00.000Z`);
    }
  }
  const marked = new Set((input.markedDates || []).map((d) => String(d).slice(0, 10)));
  const today = String(input.today || toKey(new Date())).slice(0, 10);
  const dates = [];
  if (from <= monthEnd) {
    for (let d = new Date(from); d <= monthEnd; d.setUTCDate(d.getUTCDate() + 1)) dates.push(toKey(d));
  }
  let elapsedDays;
  if (month < today.slice(0, 7)) elapsedDays = dates.length;
  else if (month > today.slice(0, 7)) elapsedDays = dates.filter((d) => marked.has(d)).length;
  else elapsedDays = dates.filter((d) => d < today || marked.has(d)).length;
  return {
    month,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    totalDays: dates.length,
    elapsedDays,
    remainingDays: Math.max(0, dates.length - elapsedDays),
    today
  };
}

/** Format an hour count without float noise: 6 -> "6", 6.5 -> "6.5". */
function fmtHours(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Explain ONE attendance day in payroll terms — the single source used by
 * the Payroll day-by-day breakdown (and shared with salary previews):
 * what was marked, how many paid hours that means, and exactly how the
 * payable amount was calculated from the worker's per-day wage.
 *
 * Mirrors SalaryService.postDailyEarning semantics exactly:
 *  - ABSENT / LEAVE_UNPAID earn nothing ("AB" / unpaid leave).
 *  - LEAVE_PAID is a full paid day.
 *  - PRESENT with no hours recorded = full day; HALF_DAY with no hours =
 *    half a day (managers often just tap the status).
 *  - Otherwise hoursWorked + overtimeHours are paid pro-rata; hours beyond
 *    the overtime threshold earn the overtime multiplier.
 * Example at ₹750/day (₹93.75/hr): a 6h day -> label "6h",
 * calculation "6h × ₹93.75/hr = ₹562.50", payable 56250 paise (shown ₹563).
 */
function describeAttendanceDay(input = {}) {
  const rules = input.rules || {};
  const fullDayHours = Number(rules.fullDayHours) > 0 ? Number(rules.fullDayHours) : 8;
  const normalizedRules = {
    fullDayHours,
    overtimeStartHours: Number(rules.overtimeStartHours) > 0 ? Number(rules.overtimeStartHours) : fullDayHours,
    overtimeMultiplier: Number(rules.overtimeMultiplier) > 0 ? Number(rules.overtimeMultiplier) : 1,
    workingDaysPerMonth: Number(rules.workingDaysPerMonth) > 0 ? Number(rules.workingDaysPerMonth) : 26
  };
  const status = String(input.status || "PRESENT").toUpperCase();
  const dailyRatePaise = Math.max(0, Math.round(Number(input.dailyRatePaise) || 0));
  const hourlyRatePaise = fullDayHours > 0 ? Math.round(dailyRatePaise / fullDayHours) : 0;

  if (status === "ABSENT" || status === "LEAVE_UNPAID") {
    return {
      status,
      label: status === "ABSENT" ? "AB" : "Unpaid leave",
      detailLabel: status === "ABSENT" ? "Absent (AB)" : "Unpaid leave (UL)",
      paidHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      hourlyRatePaise,
      dailyRatePaise,
      regularEarningPaise: 0,
      overtimeEarningPaise: 0,
      totalEarningPaise: 0,
      calculation: status === "ABSENT" ? "Absent — no work, no pay for this day" : "Unpaid leave — no pay for this day"
    };
  }

  let paidHours = (Number(input.hoursWorked) || 0) + (Number(input.overtimeHours) || 0);
  if (status === "LEAVE_PAID") paidHours = fullDayHours;
  else if (paidHours === 0 && status === "PRESENT") paidHours = fullDayHours;
  else if (paidHours === 0 && status === "HALF_DAY") paidHours = fullDayHours / 2;

  const calc = calculateDailyEarning({ dailyRatePaise, hoursWorked: paidHours, rules: normalizedRules });
  let label;
  if (status === "LEAVE_PAID") label = `PL · ${fmtHours(paidHours)}h full day`;
  else if (status === "HALF_DAY" && calc.overtimeHours === 0) label = `Half day · ${fmtHours(paidHours)}h`;
  else if (calc.overtimeHours > 0) label = `${fmtHours(calc.regularHours)}h + ${fmtHours(calc.overtimeHours)}h OT`;
  else if (paidHours >= fullDayHours) label = `${fmtHours(paidHours)}h · Full day`;
  else label = `${fmtHours(paidHours)}h`;

  let calculation = `${fmtHours(calc.regularHours)}h × ${(0, _money.formatINR)(calc.hourlyRatePaise)}/hr`;
  if (calc.overtimeHours > 0) {
    calculation += ` + ${fmtHours(calc.overtimeHours)}h OT × ${(0, _money.formatINR)(calc.hourlyRatePaise)}/hr × ${normalizedRules.overtimeMultiplier}`;
  }
  calculation += ` = ${(0, _money.formatINR)(calc.totalEarningPaise)}`;
  if (status === "LEAVE_PAID") calculation = `Paid leave — full day ${fmtHours(fullDayHours)}h × ${(0, _money.formatINR)(calc.hourlyRatePaise)}/hr = ${(0, _money.formatINR)(calc.totalEarningPaise)}`;
  else if (status === "HALF_DAY" && (Number(input.hoursWorked) || 0) === 0 && (Number(input.overtimeHours) || 0) === 0) {
    calculation = `Half day — ${fmtHours(paidHours)}h × ${(0, _money.formatINR)(calc.hourlyRatePaise)}/hr = ${(0, _money.formatINR)(calc.totalEarningPaise)}`;
  }

  return {
    status,
    label,
    detailLabel: label,
    paidHours,
    regularHours: calc.regularHours,
    overtimeHours: calc.overtimeHours,
    hourlyRatePaise: calc.hourlyRatePaise,
    dailyRatePaise,
    regularEarningPaise: calc.regularEarningPaise,
    overtimeEarningPaise: calc.overtimeEarningPaise,
    totalEarningPaise: calc.totalEarningPaise,
    calculation
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
  // For a worker's CURRENT salary month, the caller can supply the actual
  // number of calendar days in that worker's payable period (for example
  // joined on 24 Oct -> 24..31 Oct = 8 days). That period count overrides
  // the generic 26-working-day month for this box; 26 remains the standard
  // full-month conversion used for monthly-rate derivation.
  const scheduledDays = Number(input.scheduledDays) > 0 ? Number(input.scheduledDays) : workingDaysPerMonth;
  const dailyRatePaise = Math.max(0, Number(input.dailyRatePaise) || 0);
  const totalEarningsPaise = Math.max(0, Number(input.totalEarningsPaise) || 0);
  const elapsedDays = Math.min(scheduledDays, Math.max(0, Number(input.elapsedDays) || 0));
  const remainingDays = Math.max(0, scheduledDays - elapsedDays);
  const expectedRemainingEarningsPaise = Math.round(dailyRatePaise * remainingDays);
  const projectedGrossPaise = (0, _money.addPaise)(totalEarningsPaise, expectedRemainingEarningsPaise);
  const paidDeductionsPaise = (0, _money.addPaise)(input.advanceDeductionsPaise || 0, input.kharchiDeductionsPaise || 0, input.otherDeductionsPaise || 0);
  const pendingDeductionsPaise = (0, _money.addPaise)(input.pendingAdvancePaise || 0, input.pendingKharchiPaise || 0);
  const projectedNetPaise = Math.max(0, projectedGrossPaise - paidDeductionsPaise);
  return {
    workingDaysPerMonth,
    scheduledDays,
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