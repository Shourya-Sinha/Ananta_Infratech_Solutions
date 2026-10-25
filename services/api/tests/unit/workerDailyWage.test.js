"use strict";
/* Per-day wage at worker registration: work type = trade only, money is a
 * separate admin-entered field stored on the profile (salaryMode=DAILY). */
const { workerRegisterSchema } = require("@ananta/validation");

describe("workerRegisterSchema dailyRateRupees", () => {
  const base = { name: "Ramesh Kumar", phone: "9876543210", workTypeId: "wt1" };
  test("accepts the admin-entered per-day wage", () => {
    expect(workerRegisterSchema.parse({ ...base, dailyRateRupees: 750 }).dailyRateRupees).toBe(750);
  });
  test("optional — omitted wage falls back to the work-type standard rate", () => {
    expect(workerRegisterSchema.parse(base).dailyRateRupees).toBeUndefined();
  });
  test("rejects zero / negative wages", () => {
    expect(() => workerRegisterSchema.parse({ ...base, dailyRateRupees: 0 })).toThrow();
    expect(() => workerRegisterSchema.parse({ ...base, dailyRateRupees: -500 })).toThrow();
  });
});
