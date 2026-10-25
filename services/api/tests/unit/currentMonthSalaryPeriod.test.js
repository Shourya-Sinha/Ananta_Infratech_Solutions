"use strict";

/*
 * Current-month salary period: a worker created on 24 Oct is estimated only
 * for 24..31 Oct (8 calendar days), not a generic 26-day month. As days pass
 * or attendance is marked, elapsed days stop being earnable.
 */
const { getSalaryPeriodSchedule, projectMonthlySalary } = require("@ananta/utils");

describe("getSalaryPeriodSchedule", () => {
  test("worker created 24 Oct: Oct salary period is 24-31 Oct = 8 days", () => {
    const s = getSalaryPeriodSchedule({ month: "2026-10", workerStartDate: "2026-10-24T10:30:00.000Z", today: "2026-10-24", markedDates: [] });
    expect(s).toMatchObject({ from: "2026-10-24", to: "2026-10-31", totalDays: 8, elapsedDays: 0, remainingDays: 8 });
  });

  test("₹750/day worker created 24 Oct starts at ₹6,000 for the rest of October", () => {
    const s = getSalaryPeriodSchedule({ month: "2026-10", workerStartDate: "2026-10-24", today: "2026-10-24", markedDates: [] });
    const p = projectMonthlySalary({ dailyRatePaise: 750_00, workingDaysPerMonth: 26, scheduledDays: s.totalDays, elapsedDays: s.elapsedDays, totalEarningsPaise: 0 });
    expect(p.projectedGrossPaise).toBe(6_000_00);
    expect(p.projectedNetPaise).toBe(6_000_00);
    expect(p.remainingDays).toBe(8);
  });

  test("two days later with no attendance marked, only 28-31 Oct remains earnable", () => {
    const s = getSalaryPeriodSchedule({ month: "2026-10", workerStartDate: "2026-10-24", today: "2026-10-28", markedDates: [] });
    expect(s.elapsedDays).toBe(4); // 24,25,26,27 Oct are gone (backfill can change this)
    expect(s.remainingDays).toBe(4);
  });

  test("marking today absent makes today elapsed immediately", () => {
    const s = getSalaryPeriodSchedule({ month: "2026-10", workerStartDate: "2026-10-24", today: "2026-10-24", markedDates: ["2026-10-24"] });
    expect(s.elapsedDays).toBe(1);
    expect(s.remainingDays).toBe(7);
  });

  test("worker created before the month gets the whole calendar month as period", () => {
    const s = getSalaryPeriodSchedule({ month: "2026-10", workerStartDate: "2026-08-01", today: "2026-10-01", markedDates: [] });
    expect(s).toMatchObject({ from: "2026-10-01", to: "2026-10-31", totalDays: 31, remainingDays: 31 });
  });
});
