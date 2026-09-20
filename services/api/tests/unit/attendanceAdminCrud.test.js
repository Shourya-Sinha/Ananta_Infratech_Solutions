jest.mock("../../src/db/models/Attendance", () => ({
  Attendance: {
    findById: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn()
  }
}));
jest.mock("../../src/db/models/WorkerProfile", () => ({
  WorkerProfile: { findById: jest.fn() }
}));
jest.mock("../../src/db/models/Site", () => ({
  Site: { findById: jest.fn() }
}));
jest.mock("../../src/modules/salary/salary.service", () => ({
  SalaryService: {
    postDailyEarning: jest.fn(),
    reverseEarningsForAttendance: jest.fn(),
    recalculateMonth: jest.fn()
  }
}));
jest.mock("../../src/modules/auditLogs/audit.service", () => ({
  AuditService: { log: jest.fn() }
}));
jest.mock("../../src/modules/notifications/notification.service", () => ({
  NotificationService: { send: jest.fn() }
}));
jest.mock("../../src/sockets/gateway", () => ({
  getIO: jest.fn(() => ({ to: jest.fn().mockReturnThis(), emit: jest.fn() }))
}));

const { Attendance } = require("../../src/db/models/Attendance");
const { SalaryService } = require("../../src/modules/salary/salary.service");
const { AttendanceService } = require("../../src/modules/attendance/attendance.service");

const actorId = "admin-1";

function attendanceDoc(overrides = {}) {
  return {
    _id: "att-1",
    worker: { toString: () => "worker-1" },
    site: { toString: () => "site-1" },
    date: new Date("2026-09-05T00:00:00Z"),
    status: "PRESENT",
    hoursWorked: 8,
    overtimeHours: 0,
    locked: false,
    correctionOf: null,
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  SalaryService.recalculateMonth.mockResolvedValue({});
});

describe("AttendanceService.remove (admin delete)", () => {
  test("deletes the record, reverses its salary posting and recalculates the month", async () => {
    const doc = attendanceDoc();
    Attendance.findById.mockResolvedValue(doc);
    Attendance.find.mockResolvedValue([]); // no correction chain
    SalaryService.reverseEarningsForAttendance.mockResolvedValue([{ debitPaise: "48000" }]);

    const result = await AttendanceService.remove("att-1", actorId);

    expect(result).toEqual({ deleted: true, reversedLedgerEntries: 1 });
    expect(SalaryService.reverseEarningsForAttendance).toHaveBeenCalledWith(
      "att-1",
      expect.objectContaining({ actorId, description: expect.stringContaining("deleted") })
    );
    expect(Attendance.deleteMany).toHaveBeenCalledWith({ _id: { $in: [doc._id] } });
    expect(SalaryService.recalculateMonth).toHaveBeenCalledWith("worker-1", "2026-09");
  });

  test("deletes the whole correction chain (superseded originals + corrections)", async () => {
    const original = attendanceDoc({ _id: "att-original" });
    const correction = attendanceDoc({ _id: "att-correction", correctionOf: "att-original" });
    Attendance.findById
      .mockResolvedValueOnce(original) // target
      .mockResolvedValueOnce(correction); // chain lock check
    // 1st find: descendants of target; 2nd: descendants of correction (none)
    Attendance.find
      .mockResolvedValueOnce([correction])
      .mockResolvedValueOnce([]);
    SalaryService.reverseEarningsForAttendance.mockResolvedValue([]);

    await AttendanceService.remove("att-original", actorId);

    const deletedIds = Attendance.deleteMany.mock.calls[0][0]._id.$in.map(String);
    expect(deletedIds).toEqual(["att-original", "att-correction"]);
    // reversal attempted for every chain member
    expect(SalaryService.reverseEarningsForAttendance).toHaveBeenCalledTimes(2);
  });

  test("locked record (finalized month) → 409 PAYROLL_LOCKED and nothing deleted", async () => {
    Attendance.findById.mockResolvedValue(attendanceDoc({ locked: true }));
    await expect(AttendanceService.remove("att-1", actorId)).rejects.toMatchObject({
      code: "PAYROLL_LOCKED",
      statusCode: 409
    });
    expect(Attendance.deleteMany).not.toHaveBeenCalled();
    expect(SalaryService.reverseEarningsForAttendance).not.toHaveBeenCalled();
  });

  test("missing record → 404", async () => {
    Attendance.findById.mockResolvedValue(null);
    await expect(AttendanceService.remove("nope", actorId)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("AttendanceService.correct (admin edit — no double counting)", () => {
  test("reverses the original earning BEFORE posting the corrected earning, then recalculates", async () => {
    const original = attendanceDoc({ _id: "att-original" });
    Attendance.findById.mockResolvedValue(original);
    Attendance.create.mockResolvedValue(attendanceDoc({ _id: "att-correction", correctionOf: original._id }));
    SalaryService.reverseEarningsForAttendance.mockResolvedValue([{ debitPaise: "48000" }]);
    SalaryService.postDailyEarning.mockResolvedValue({ posted: true, entries: [] });

    await AttendanceService.correct(
      { correctionOf: "att-original", status: "HALF_DAY", hoursWorked: 4, overtimeHours: 0, reason: "wrongly marked full day" },
      actorId
    );

    expect(SalaryService.reverseEarningsForAttendance).toHaveBeenCalledWith(
      "att-original",
      expect.objectContaining({ actorId })
    );
    expect(SalaryService.postDailyEarning).toHaveBeenCalledTimes(1);
    expect(SalaryService.recalculateMonth).toHaveBeenCalledWith("worker-1", "2026-09");
  });

  test("correction order matters: reversal is posted before the new earning", async () => {
    const original = attendanceDoc({ _id: "att-original" });
    Attendance.findById.mockResolvedValue(original);
    Attendance.create.mockResolvedValue(attendanceDoc({ _id: "att-correction", correctionOf: original._id }));
    SalaryService.reverseEarningsForAttendance.mockResolvedValue([]);
    SalaryService.postDailyEarning.mockResolvedValue({ posted: false });

    const order = [];
    SalaryService.reverseEarningsForAttendance.mockImplementation(async () => {
      order.push("reverse");
      return [];
    });
    SalaryService.postDailyEarning.mockImplementation(async () => {
      order.push("post");
      return { posted: false };
    });

    await AttendanceService.correct(
      { correctionOf: "att-original", status: "ABSENT", hoursWorked: 0, overtimeHours: 0, reason: "worker was absent" },
      actorId
    );
    expect(order).toEqual(["reverse", "post"]);
    // Even though nothing new was posted, the reversal changed the ledger → recalc runs.
    expect(SalaryService.recalculateMonth).toHaveBeenCalled();
  });

  test("locked original → 409 PAYROLL_LOCKED", async () => {
    Attendance.findById.mockResolvedValue(attendanceDoc({ locked: true }));
    await expect(
      AttendanceService.correct(
        { correctionOf: "att-1", status: "PRESENT", hoursWorked: 8, overtimeHours: 0, reason: "late correction" },
        actorId
      )
    ).rejects.toMatchObject({ code: "PAYROLL_LOCKED" });
  });
});
