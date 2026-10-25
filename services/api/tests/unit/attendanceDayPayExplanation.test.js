"use strict";

/*
 * Payroll must explain a short-hour PRESENT day: marked 6h at ₹750/day it
 * pays ₹562.50 (shown ₹563) and must display "6h" with the calculation —
 * not a bare "1P" that looks like a full paid day.
 */
const { describeAttendanceDay } = require("@ananta/utils");

const RULES = { fullDayHours: 8, overtimeStartHours: 8, overtimeMultiplier: 1.5, workingDaysPerMonth: 26 };
const at750 = (over) => describeAttendanceDay({ dailyRatePaise: 750_00, rules: RULES, ...over });

describe("describeAttendanceDay (₹750/day = ₹93.75/hr)", () => {
  test("6-hour PRESENT day: label 6h, calculation and ₹562.50 payable", () => {
    const d = at750({ status: "PRESENT", hoursWorked: 6, overtimeHours: 0 });
    expect(d.label).toBe("6h");
    expect(d.calculation).toBe("6h × ₹93.75/hr = ₹562.50");
    expect(d.totalEarningPaise).toBe(562_50);
    expect(Math.round(d.totalEarningPaise / 100)).toBe(563); // how Payroll rounds it
  });

  test.each([[1, 93_75], [2, 187_50], [4, 375_00]])("%sh day pays pro-rata", (hours, paise) => {
    const d = at750({ status: "PRESENT", hoursWorked: hours, overtimeHours: 0 });
    expect(d.label).toBe(`${hours}h`);
    expect(d.totalEarningPaise).toBe(paise);
  });

  test("8h is a full day at the full per-day wage", () => {
    const d = at750({ status: "PRESENT", hoursWorked: 8, overtimeHours: 0 });
    expect(d.label).toBe("8h · Full day");
    expect(d.totalEarningPaise).toBe(750_00);
  });

  test("PRESENT with no hours recorded still means a full day (tap-to-mark)", () => {
    const d = at750({ status: "PRESENT", hoursWorked: 0, overtimeHours: 0 });
    expect(d.label).toBe("8h · Full day");
    expect(d.totalEarningPaise).toBe(750_00);
  });

  test("overtime day shows regular + OT hours and the multiplied calculation", () => {
    const d = at750({ status: "PRESENT", hoursWorked: 8, overtimeHours: 2 });
    expect(d.label).toBe("8h + 2h OT");
    expect(d.overtimeEarningPaise).toBe(281_25); // 2 × 93.75 × 1.5
    expect(d.totalEarningPaise).toBe(1_031_25);
    expect(d.calculation).toContain("2h OT × ₹93.75/hr × 1.5");
  });

  test("absent shows AB and earns nothing", () => {
    const d = at750({ status: "ABSENT", hoursWorked: 0, overtimeHours: 0 });
    expect(d.label).toBe("AB");
    expect(d.totalEarningPaise).toBe(0);
    expect(d.calculation).toMatch(/Absent/);
  });

  test("half day with no hours = 4h; paid leave = full day", () => {
    expect(at750({ status: "HALF_DAY", hoursWorked: 0, overtimeHours: 0 })).toMatchObject({ label: "Half day · 4h", totalEarningPaise: 375_00 });
    expect(at750({ status: "LEAVE_PAID", hoursWorked: 0, overtimeHours: 0 }).totalEarningPaise).toBe(750_00);
    expect(at750({ status: "LEAVE_UNPAID", hoursWorked: 0, overtimeHours: 0 }).totalEarningPaise).toBe(0);
  });
});
