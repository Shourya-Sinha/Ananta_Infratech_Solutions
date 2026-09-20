jest.mock("../../src/db/models/SalaryLedger", () => ({
  SalaryLedger: { find: jest.fn(), create: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../src/db/models/Attendance", () => ({
  Attendance: { aggregate: jest.fn() }
}));
jest.mock("../../src/db/models/WorkerProfile", () => ({
  WorkerProfile: { findById: jest.fn() }
}));
jest.mock("../../src/db/models/MonthlyPayroll", () => ({
  MonthlyPayroll: { findOne: jest.fn(), findOneAndUpdate: jest.fn() }
}));

const { SalaryLedger } = require("../../src/db/models/SalaryLedger");
const { Attendance } = require("../../src/db/models/Attendance");
const { MonthlyPayroll } = require("../../src/db/models/MonthlyPayroll");
const { SalaryService } = require("../../src/modules/salary/salary.service");

const attendanceId = "507f1f77bcf86cd7994390a1";
const workerId = "507f1f77bcf86cd7994390b2";

function ledgerEntry(overrides = {}) {
  return {
    worker: workerId,
    site: "507f1f77bcf86cd7994390c3",
    date: new Date("2026-09-05"),
    type: "EARNING",
    description: "Regular earning",
    creditPaise: "48000", // ₹480
    debitPaise: "0",
    runningBalancePaise: "48000",
    reference: attendanceId,
    createdBy: "actor",
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  SalaryLedger.create.mockImplementation(async (doc) => doc);
  // getLastRunningBalance: findOne(...).sort(...) → no prior entry (balance 0)
  SalaryLedger.findOne.mockReturnValue({ sort: async () => null });
});

/** find(...).sort(...) chain — entries already in creation order. */
function ledgerFindReturns(entries) {
  SalaryLedger.find.mockReturnValueOnce({ sort: async () => entries });
}

describe("SalaryService.reverseEarningsForAttendance", () => {
  test("posts REVERSAL debits equal to the original earning credits", async () => {
    ledgerFindReturns([ledgerEntry()]);
    const created = await SalaryService.reverseEarningsForAttendance(attendanceId, {
      actorId: "admin-1",
      description: "attendance deleted"
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      type: "REVERSAL",
      creditPaise: "0",
      debitPaise: "48000",
      reference: attendanceId
    });
  });

  test("handles EARNING + OVERTIME (two entries)", async () => {
    ledgerFindReturns([
      ledgerEntry(),
      ledgerEntry({ type: "OVERTIME", creditPaise: "9000", description: "Overtime earning" })
    ]);
    const created = await SalaryService.reverseEarningsForAttendance(attendanceId, {});
    expect(created).toHaveLength(2);
    const totalDebit = created.reduce((sum, c) => sum + Number(c.debitPaise), 0);
    expect(totalDebit).toBe(57000); // 480 + 90 rupees
  });

  test("never reverses twice: an already-reversed posting yields nothing new", async () => {
    // History: original EARNING ₹480 + a REVERSAL debit ₹480 (from a correction).
    ledgerFindReturns([
      ledgerEntry(),
      ledgerEntry({ type: "REVERSAL", creditPaise: "0", debitPaise: "48000" })
    ]);
    const created = await SalaryService.reverseEarningsForAttendance(attendanceId, {});
    expect(created).toHaveLength(0); // fully reversed already
  });

  test("reverses only the outstanding remainder on a partial reversal", async () => {
    // History: EARNING ₹480, OVERTIME ₹90, and a prior REVERSAL of ₹100.
    ledgerFindReturns([
      ledgerEntry(),
      ledgerEntry({ type: "OVERTIME", creditPaise: "9000" }),
      ledgerEntry({ type: "REVERSAL", creditPaise: "0", debitPaise: "10000" })
    ]);
    const created = await SalaryService.reverseEarningsForAttendance(attendanceId, {});
    const totalDebit = created.reduce((sum, c) => sum + Number(c.debitPaise), 0);
    expect(totalDebit).toBe(47000); // remaining 57000 − 10000 already reversed
  });
});

describe("SalaryService.recalculateMonth (clear per-worker amounts + attendance summary)", () => {
  test("net = gross + overtime − advance − kharchi − other, with day counts stored", async () => {
    SalaryLedger.find.mockResolvedValueOnce([
      ledgerEntry({ type: "EARNING", creditPaise: "384000", debitPaise: "0" }), // ₹3,840 gross
      ledgerEntry({ type: "OVERTIME", creditPaise: "72000", debitPaise: "0" }), // ₹720 OT
      ledgerEntry({ type: "ADVANCE_DEDUCTION", creditPaise: "0", debitPaise: "100000" }), // ₹1,000
      ledgerEntry({ type: "KHARCHI_DEDUCTION", creditPaise: "0", debitPaise: "25000" }) // ₹250
    ]);
    Attendance.aggregate.mockResolvedValueOnce([
      { _id: "PRESENT", count: 20, overtimeHours: 4 },
      { _id: "HALF_DAY", count: 2, overtimeHours: 0 },
      { _id: "ABSENT", count: 1, overtimeHours: 0 }
    ]);
    MonthlyPayroll.findOne.mockResolvedValueOnce(null);
    let savedUpdate = null;
    MonthlyPayroll.findOneAndUpdate.mockImplementationOnce(async (_q, update) => {
      savedUpdate = update;
      return { worker: workerId, month: "2026-09", ...update };
    });

    const payroll = await SalaryService.recalculateMonth(workerId, "2026-09");

    expect(payroll.grossEarningsPaise).toBe(384000);
    expect(payroll.overtimeEarningsPaise).toBe(72000);
    expect(payroll.advanceDeductionsPaise).toBe(100000);
    expect(payroll.kharchiDeductionsPaise).toBe(25000);
    // Net = 3840 + 720 − 1000 − 250 = ₹3,310 exactly
    expect(payroll.netSalaryPaise).toBe(331000);
    expect(savedUpdate).toMatchObject({
      presentDays: 20,
      halfDays: 2,
      absentDays: 1,
      overtimeHours: 4,
      status: "CALCULATED"
    });
  });

  test("refuses to recalculate a FINALIZED month", async () => {
    SalaryLedger.find.mockResolvedValueOnce([]);
    Attendance.aggregate.mockResolvedValueOnce([]);
    MonthlyPayroll.findOne.mockResolvedValueOnce({ status: "FINALIZED" });
    await expect(SalaryService.recalculateMonth(workerId, "2026-09")).rejects.toMatchObject({
      code: "CONFLICT"
    });
  });
});
