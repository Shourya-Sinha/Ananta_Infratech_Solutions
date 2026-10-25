"use strict";

/*
 * End-to-end arithmetic of the registration per-day wage (pure functions —
 * the same ones SalaryService uses for attendance posting, previews,
 * statements, payroll and site finance):
 *   Add Worker wage ₹750/day (stored as salaryMode=DAILY, 75000 paise)
 *     → per hour ₹93.75 (750 ÷ 8)
 *     → approximate monthly ₹19,500 (750 × 26 working days)
 *     → full day earns ₹750, half day ₹375, 10h day = 8h + 2h OT @1.5×
 *     → net = gross − advances − Kharchi (finance never double-counts)
 * Also: worker's agreed rate beats the work-type standard; editing the wage
 * later (setWorkerSalaryRate semantics) only changes the stored basis.
 */
const { deriveSalaryRates, calculateDailyEarning, calculateNetSalary, expectedMonthlyGrossPaise } = require("@ananta/utils");
// Same shape SalaryRuleService.getActiveRuleSet() returns at runtime.
// OT multiplier is an admin-configurable SalaryRule (seed default 1.0 =
// straight rate); 1.5 here shows a configured premium flows through too.
const RULES = { fullDayHours: 8, overtimeStartHours: 8, overtimeMultiplier: 1.5, workingDaysPerMonth: 26 };

describe("per-day wage → every derived figure", () => {
  const rates = deriveSalaryRates({ salaryMode: "DAILY", dailyRatePaise: 750_00 }, RULES);

  test("per hour = wage ÷ 8, approximate monthly = wage × 26", () => {
    expect(rates.source).toBe("DAILY");
    expect(rates.dailyRatePaise).toBe(750_00);
    expect(rates.hourlyRatePaise).toBe(93_75); // ₹93.75
    expect(rates.monthlySalaryPaise).toBe(19_500_00); // ₹19,500
    expect(expectedMonthlyGrossPaise(rates)).toBe(19_500_00);
  });

  test("full day earns the wage, half day earns half", () => {
    expect(calculateDailyEarning({ dailyRatePaise: rates.dailyRatePaise, hoursWorked: 8, rules: RULES }).totalEarningPaise).toBe(750_00);
    expect(calculateDailyEarning({ dailyRatePaise: rates.dailyRatePaise, hoursWorked: 4, rules: RULES }).totalEarningPaise).toBe(375_00);
  });

  test("overtime: 10-hour day = 8 regular + 2 OT at 1.5× hourly", () => {
    const day = calculateDailyEarning({ dailyRatePaise: rates.dailyRatePaise, hoursWorked: 10, rules: RULES });
    expect(day.regularEarningPaise).toBe(750_00);
    expect(day.overtimeEarningPaise).toBe(281_25); // 2 × 93.75 × 1.5
    expect(day.totalEarningPaise).toBe(1_031_25);
  });

  test("approximate MONTH salary from mixed attendance, then net after advance + Kharchi", () => {
    // 22 present + 2 half days = 23 day-equivalents; 2 paid leave = full days → 25
    const grossPaise = 25 * rates.dailyRatePaise;
    const net = calculateNetSalary({
      grossEarningsPaise: grossPaise,
      overtimeEarningsPaise: 0,
      advanceDeductionsPaise: 5_000_00,
      kharchiDeductionsPaise: 1_200_00,
      otherDeductionsPaise: 0
    });
    expect(net).toBe(18_750_00 - 6_200_00); // gross ₹18,750 − ₹5,000 advance − ₹1,200 Kharchi
  });

  test("worker's agreed wage wins over the work-type standard rate", () => {
    const r = deriveSalaryRates(
      { salaryMode: "DAILY", dailyRatePaise: 750_00, fallbackDailyRatePaise: 900_00 },
      RULES
    );
    expect(r.source).toBe("DAILY");
    expect(r.dailyRatePaise).toBe(750_00);
  });

  test("no agreed wage → work-type standard still applies (older workers)", () => {
    const r = deriveSalaryRates({ fallbackDailyRatePaise: 900_00 }, RULES);
    expect(r.source).toBe("WORK_TYPE_DEFAULT");
    expect(r.monthlySalaryPaise).toBe(23_400_00);
  });

  test("editing the wage later re-derives consistently (₹800/day)", () => {
    const r = deriveSalaryRates({ salaryMode: "DAILY", dailyRatePaise: 800_00 }, RULES);
    expect(r.hourlyRatePaise).toBe(100_00);
    expect(r.monthlySalaryPaise).toBe(20_800_00);
  });

  test("hourly/monthly bases still convert through the same per-day wage", () => {
    expect(deriveSalaryRates({ salaryMode: "HOURLY", hourlyRatePaise: 100_00 }, RULES).dailyRatePaise).toBe(800_00);
    expect(deriveSalaryRates({ salaryMode: "MONTHLY", monthlySalaryPaise: 19_500_00 }, RULES).dailyRatePaise).toBe(750_00);
  });
});
