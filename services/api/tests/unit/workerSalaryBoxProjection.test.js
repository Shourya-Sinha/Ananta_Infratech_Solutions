"use strict";

/*
 * Worker-page salary box lifecycle for a ₹750/day worker (8h day, 26
 * working days): it starts at the approximate full-month salary, then the
 * projected total decreases as attendance is recorded — absent day, short
 * 2h/6h days — and paid advance/Kharchi deductions settle against it.
 */
const { projectMonthlySalary, deriveSalaryRates, calculateDailyEarning } = require("@ananta/utils");
const { buildStatement } = require("../../src/modules/salary/statement");

const RULES = { fullDayHours: 8, overtimeStartHours: 8, overtimeMultiplier: 1, workingDaysPerMonth: 26 };
const rates = deriveSalaryRates({ salaryMode: "DAILY", dailyRatePaise: 750_00 }, RULES);
const project = (over = {}) => projectMonthlySalary({
  dailyRatePaise: rates.dailyRatePaise,
  workingDaysPerMonth: rates.workingDaysPerMonth,
  totalEarningsPaise: 0,
  elapsedDays: 0,
  ...over
});

describe("worker salary box projection", () => {
  test("just registered, no attendance/advance/Kharchi: per-day wage × current-month working days", () => {
    const p = project();
    expect(p.remainingDays).toBe(26);
    expect(p.projectedGrossPaise).toBe(19_500_00);
    expect(p.projectedNetPaise).toBe(19_500_00);
  });

  test("one absent day reduces the box by exactly one per-day wage", () => {
    const p = project({ elapsedDays: 1, totalEarningsPaise: 0 });
    expect(p.projectedGrossPaise).toBe(18_750_00);
  });

  test("a 2-hour day reduces the box by the 6 unworked hours", () => {
    const earned = calculateDailyEarning({ dailyRatePaise: rates.dailyRatePaise, hoursWorked: 2, rules: RULES }).totalEarningPaise;
    const p = project({ elapsedDays: 1, totalEarningsPaise: earned });
    expect(earned).toBe(187_50);
    expect(p.projectedGrossPaise).toBe(18_937_50); // ₹19,500 − ₹562.50
  });

  test("a 6-hour day reduces the box by the 2 unworked hours", () => {
    const earned = calculateDailyEarning({ dailyRatePaise: rates.dailyRatePaise, hoursWorked: 6, rules: RULES }).totalEarningPaise;
    const p = project({ elapsedDays: 1, totalEarningsPaise: earned });
    expect(p.projectedGrossPaise).toBe(19_312_50); // ₹19,500 − ₹187.50
  });

  test("full present day keeps the box at the full-month estimate", () => {
    const earned = calculateDailyEarning({ dailyRatePaise: rates.dailyRatePaise, hoursWorked: 8, rules: RULES }).totalEarningPaise;
    expect(project({ elapsedDays: 1, totalEarningsPaise: earned }).projectedGrossPaise).toBe(19_500_00);
  });

  test("paid advance and Kharchi settle against the salary box; requested ones stay pending", () => {
    const p = project({
      elapsedDays: 10,
      totalEarningsPaise: 7_500_00,
      advanceDeductionsPaise: 5_000_00,
      kharchiDeductionsPaise: 1_200_00,
      pendingAdvancePaise: 2_000_00,
      pendingKharchiPaise: 500_00
    });
    expect(p.projectedGrossPaise).toBe(19_500_00);
    expect(p.projectedNetPaise).toBe(13_300_00);
    expect(p.projectedNetAfterPendingPaise).toBe(10_800_00);
  });

  test("statement exposes marked/elapsed days so absences count as elapsed", () => {
    const statement = buildStatement({
      month: "2026-10",
      entries: [],
      attendance: { presentDays: 8, halfDays: 1, absentDays: 2, paidLeaveDays: 1, unpaidLeaveDays: 1, markedDays: 13 }
    });
    expect(statement.attendance.markedDays).toBe(13);
  });
});
