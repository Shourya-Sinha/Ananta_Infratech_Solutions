"use strict";

/*
 * Every paise matters: money is integer paise end-to-end and FORMATTING
 * must show the exact paise — ₹93.75/hr and ₹562.50 for a 6h day at
 * ₹750/day — never "₹94/hr" or "₹563" (nearest-rupee display rounding
 * previously hid 50 paise and made the rate look wrong).
 */
const { formatINR, rupeesToPaise, paiseToRupees } = require("@ananta/utils");
const { describeAttendanceDay } = require("@ananta/utils");

describe("exact paise formatting", () => {
  test("hourly rate derived from ₹750/day displays as ₹93.75, not ₹94", () => {
    expect(formatINR(93_75)).toContain("93.75");
  });
  test("6h day displays as ₹562.50, not ₹563", () => {
    expect(formatINR(562_50)).toContain("562.50");
  });
  test("whole rupees still show paise precision (₹750.00)", () => {
    expect(formatINR(750_00)).toContain("750.00");
  });
  test("single paise survives formatting", () => {
    expect(formatINR(1)).toContain("0.01");
  });
  test("rupee<->paise conversion is exact for 2-decimal amounts", () => {
    expect(rupeesToPaise(562.50)).toBe(562_50);
    expect(paiseToRupees(562_50)).toBe(562.5);
    expect(rupeesToPaise(93.75)).toBe(93_75);
  });
  test("day calculation string itself carries exact paise", () => {
    const d = describeAttendanceDay({
      status: "PRESENT", hoursWorked: 6, overtimeHours: 0,
      dailyRatePaise: 750_00,
      rules: { fullDayHours: 8, overtimeStartHours: 8, overtimeMultiplier: 1.5 }
    });
    expect(d.calculation).toBe("6h × ₹93.75/hr = ₹562.50");
    expect(d.hourlyRatePaise).toBe(93_75);
    expect(d.totalEarningPaise).toBe(562_50);
  });
});
