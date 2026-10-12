const {
  buildStatement,
  currentMonthIST,
  monthBounds
} = require("../../src/modules/salary/statement");

const d = (iso) => new Date(iso);

describe("salary statement (live, current month)", () => {
  const entries = [
    { id: "a", date: d("2026-10-01"), type: "EARNING", description: "Day 1", creditPaise: 50000, debitPaise: 0 },
    { id: "b", date: d("2026-10-02"), type: "EARNING", description: "Day 2", creditPaise: 50000, debitPaise: 0 },
    { id: "c", date: d("2026-10-02"), type: "OVERTIME", description: "OT", creditPaise: 10000, debitPaise: 0 },
    { id: "d", date: d("2026-10-03"), type: "ADVANCE_DEDUCTION", description: "Advance", creditPaise: 0, debitPaise: 30000 },
    { id: "e", date: d("2026-10-03"), type: "KHARCHI_DEDUCTION", description: "Tea", creditPaise: 0, debitPaise: 2500 }
  ];

  it("nets total earnings minus advances and kharchi", () => {
    const s = buildStatement({ month: "2026-10", entries });
    expect(s.totals.totalEarningsPaise).toBe(110000);
    expect(s.totals.advanceDeductionsPaise).toBe(30000);
    expect(s.totals.kharchiDeductionsPaise).toBe(2500);
    expect(s.totals.netSalaryPaise).toBe(77500);
    expect(s.payrollStatus).toBe("LIVE");
  });

  it("updates immediately when another deduction is posted", () => {
    const more = [...entries, { id: "f", date: d("2026-10-04"), type: "KHARCHI_DEDUCTION", description: "Diesel", creditPaise: 0, debitPaise: 5000 }];
    expect(buildStatement({ month: "2026-10", entries: more }).totals.netSalaryPaise).toBe(72500);
  });

  it("groups by day, newest first, with signed per-day totals", () => {
    const s = buildStatement({ month: "2026-10", entries });
    expect(s.daily.map((x) => x.date)).toEqual(["2026-10-03", "2026-10-02", "2026-10-01"]);
    const day3 = s.daily[0];
    expect(day3.deductionsPaise).toBe(32500);
    expect(day3.netPaise).toBe(-32500);
    expect(day3.entries.every((e) => e.direction === "DEBIT")).toBe(true);
    expect(s.daily[1].earningsPaise).toBe(60000);
  });

  it("reports pending requests separately without deducting them", () => {
    const s = buildStatement({ month: "2026-10", entries, pendingAdvancePaise: 100000, pendingKharchiPaise: 9900 });
    expect(s.pending).toEqual({ advancePaise: 100000, kharchiPaise: 9900 });
    expect(s.totals.netSalaryPaise).toBe(77500);
  });

  it("handles an empty month and reflects payroll status when calculated", () => {
    const s = buildStatement({ month: "2026-09", entries: [], payrollStatus: "CALCULATED" });
    expect(s.totals.netSalaryPaise).toBe(0);
    expect(s.daily).toEqual([]);
    expect(s.balancePaise).toBeNull();
    expect(s.payrollStatus).toBe("CALCULATED");
  });
});

describe("calendar month helpers", () => {
  it("picks the month in Asia/Kolkata, not UTC", () => {
    // 2026-10-31 20:00 UTC is already 2026-11-01 01:30 in IST.
    expect(currentMonthIST(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11");
    expect(currentMonthIST(new Date("2026-10-12T06:00:00Z"))).toBe("2026-10");
  });

  it("returns UTC bounds covering the whole month", () => {
    const { from, to } = monthBounds("2026-02");
    expect(from.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-02-28T23:59:59.000Z");
  });
});
