Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calculateDailyEarning = calculateDailyEarning;
exports.calculateNetSalary = calculateNetSalary;
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
function calculateNetSalary(input) {
  const gross = (0, _money.addPaise)(input.grossEarningsPaise, input.overtimeEarningsPaise);
  const deductions = (0, _money.addPaise)(input.advanceDeductionsPaise, input.kharchiDeductionsPaise, input.otherDeductionsPaise);
  return gross - deductions;
}

// re-exported for convenience so callers only need one import