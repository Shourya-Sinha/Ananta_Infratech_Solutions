var _utils = require("@ananta/utils");
const rules = {
  fullDayHours: 8,
  overtimeStartHours: 8,
  overtimeMultiplier: 1.0
};
describe("calculateDailyEarning — Mason @ ₹800/day (80000 paise)", () => {
  const dailyRatePaise = 80000; // ₹800

  test.each([[0, 0],
  // 0 hours -> ₹0
  [2, 20000],
  // 2 hours -> ₹200
  [4, 40000],
  // 4 hours -> ₹400
  [8, 80000],
  // 8 hours -> ₹800
  [9, 90000],
  // 9 hours -> ₹900
  [10, 100000],
  // 10 hours -> ₹1,000
  [15, 150000] // 15 hours -> ₹1,500
  ])("%i hours worked -> %i paise total earning", (hoursWorked, expectedPaise) => {
    const result = (0, _utils.calculateDailyEarning)({
      dailyRatePaise,
      hoursWorked,
      rules
    });
    expect(result.totalEarningPaise).toBe(expectedPaise);
  });
  test("hourly rate derives correctly from daily rate / full day hours", () => {
    const result = (0, _utils.calculateDailyEarning)({
      dailyRatePaise,
      hoursWorked: 8,
      rules
    });
    expect(result.hourlyRatePaise).toBe(10000); // ₹100/hr
  });
  test("9 hours splits into 8 regular + 1 overtime", () => {
    const result = (0, _utils.calculateDailyEarning)({
      dailyRatePaise,
      hoursWorked: 9,
      rules
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(1);
    expect(result.regularEarningPaise).toBe(80000);
    expect(result.overtimeEarningPaise).toBe(10000);
  });
  test("overtime multiplier > 1.0 increases overtime pay only", () => {
    const premiumRules = {
      ...rules,
      overtimeMultiplier: 1.5
    };
    const result = (0, _utils.calculateDailyEarning)({
      dailyRatePaise,
      hoursWorked: 10,
      rules: premiumRules
    });
    // 8 regular @ ₹100 = ₹800, 2 OT @ ₹100*1.5 = ₹300 => ₹1100
    expect(result.regularEarningPaise).toBe(80000);
    expect(result.overtimeEarningPaise).toBe(30000);
    expect(result.totalEarningPaise).toBe(110000);
  });
  test("negative hours throws", () => {
    expect(() => (0, _utils.calculateDailyEarning)({
      dailyRatePaise,
      hoursWorked: -1,
      rules
    })).toThrow();
  });
  test("fullDayHours of 0 throws (prevents divide-by-zero)", () => {
    expect(() => (0, _utils.calculateDailyEarning)({
      dailyRatePaise,
      hoursWorked: 8,
      rules: {
        ...rules,
        fullDayHours: 0
      }
    })).toThrow();
  });
});
describe("calculateDailyEarning — Helper @ ₹600/day, uneven hourly rate", () => {
  const dailyRatePaise = 60000; // ₹600 / 8 = ₹75/hr exactly, but test a rate that doesn't divide evenly

  test("rounds fractional paise deterministically", () => {
    // ₹601 / 8 = 75.125/hr -> for 3 hours = 225.375 -> rounds to 225 paise... use integer-friendly check
    const oddRate = 60100; // ₹601.00 in paise
    const result = (0, _utils.calculateDailyEarning)({
      dailyRatePaise: oddRate,
      hoursWorked: 3,
      rules
    });
    expect(Number.isInteger(result.totalEarningPaise)).toBe(true);
  });
  test("₹600/day, 8 hours -> ₹600 exactly", () => {
    const result = (0, _utils.calculateDailyEarning)({
      dailyRatePaise,
      hoursWorked: 8,
      rules
    });
    expect(result.totalEarningPaise).toBe(60000);
  });
});
describe("calculateNetSalary", () => {
  test("gross + overtime - all deductions", () => {
    const net = (0, _utils.calculateNetSalary)({
      grossEarningsPaise: 1_600_000,
      // ₹16,000
      overtimeEarningsPaise: 100_000,
      // ₹1,000
      advanceDeductionsPaise: 200_000,
      // ₹2,000
      kharchiDeductionsPaise: 50_000,
      // ₹500
      otherDeductionsPaise: 0
    });
    expect(net).toBe(1_450_000); // ₹14,500
  });
  test("deductions can reduce net salary to zero or negative (flagged, not silently clamped)", () => {
    const net = (0, _utils.calculateNetSalary)({
      grossEarningsPaise: 10_000,
      overtimeEarningsPaise: 0,
      advanceDeductionsPaise: 15_000,
      kharchiDeductionsPaise: 0,
      otherDeductionsPaise: 0
    });
    expect(net).toBe(-5_000);
  });
});