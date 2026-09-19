var _mongoose = _interopRequireDefault(require("mongoose"));
var _mongodbMemoryServer = require("mongodb-memory-server");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// Socket.IO gateway isn't initialized in this test process; attendance/salary
// services catch that gracefully in NotificationService but AttendanceService
// calls getIO() directly for its own emits, so we stub the gateway module.
jest.mock("../../src/sockets/gateway", () => ({
  getIO: () => ({
    to: () => ({
      to: () => ({
        to: () => ({
          emit: jest.fn()
        }),
        emit: jest.fn()
      }),
      emit: jest.fn()
    })
  })
}));
let mongod;
beforeAll(async () => {
  mongod = await _mongodbMemoryServer.MongoMemoryServer.create();
  await _mongoose.default.connect(mongod.getUri());
});
afterAll(async () => {
  await _mongoose.default.disconnect();
  await mongod?.stop();
});
describe("Attendance -> SalaryLedger -> MonthlyPayroll integration", () => {
  it("posts correct earnings and rolls up to monthly payroll", async () => {
    const {
      Role
    } = await import("../../src/db/models/Role");
    const {
      User
    } = await import("../../src/db/models/User");
    const {
      WorkType
    } = await import("../../src/db/models/WorkType");
    const {
      Site
    } = await import("../../src/db/models/Site");
    const {
      WorkerProfile
    } = await import("../../src/db/models/WorkerProfile");
    const {
      AttendanceService
    } = await import("../../src/modules/attendance/attendance.service");
    const {
      MonthlyPayroll
    } = await import("../../src/db/models/MonthlyPayroll");
    const role = await Role.create({
      key: "WORKER",
      label: "Worker",
      isSystemRole: true
    });
    const adminUser = await User.create({
      role: role._id,
      name: "Admin",
      phone: "9000000000",
      passwordHash: "x",
      status: "ACTIVE"
    });
    const workerUser = await User.create({
      role: role._id,
      name: "Rahul Kumar",
      phone: "9111111111",
      passwordHash: "x",
      status: "ACTIVE"
    });
    const mason = await WorkType.create({
      name: "Mason",
      code: "MASON",
      defaultDailyRatePaise: 80000,
      // ₹800/day
      isActive: true
    });
    const site = await Site.create({
      name: "Patna Residential Project",
      code: "PRJ01",
      address: "Patna, Bihar",
      manager: adminUser._id,
      status: "ACTIVE"
    });
    const worker = await WorkerProfile.create({
      user: workerUser._id,
      employeeId: "AIS-2026-000001",
      workType: mason._id,
      currentSite: site._id,
      verificationStatus: "ACTIVE"
    });

    // Day 1: 10 hours worked -> 8 regular + 2 overtime -> ₹1000
    const {
      attendance,
      salaryResult
    } = await AttendanceService.record({
      worker: worker._id.toString(),
      site: site._id.toString(),
      date: "2026-08-14",
      status: "PRESENT",
      hoursWorked: 8,
      overtimeHours: 2
    }, adminUser._id.toString(), "SUPER_ADMIN");
    expect(attendance.status).toBe("PRESENT");
    expect(salaryResult.posted).toBe(true);

    // Day 2: 8 hours worked -> ₹800
    await AttendanceService.record({
      worker: worker._id.toString(),
      site: site._id.toString(),
      date: "2026-08-15",
      status: "PRESENT",
      hoursWorked: 8,
      overtimeHours: 0
    }, adminUser._id.toString(), "SUPER_ADMIN");
    const payroll = await MonthlyPayroll.findOne({
      worker: worker._id,
      month: "2026-08"
    });
    expect(payroll).not.toBeNull();
    // Day 1: 800 (regular) + 200 (2h overtime @ ₹100/hr) = 1000; Day 2: 800 => gross 1600, OT 200
    expect(payroll.grossEarningsPaise).toBe(160000);
    expect(payroll.overtimeEarningsPaise).toBe(20000);
    expect(payroll.netSalaryPaise).toBe(180000); // no deductions yet

    // Duplicate attendance for the same day must be rejected, not silently overwritten.
    await expect(AttendanceService.record({
      worker: worker._id.toString(),
      site: site._id.toString(),
      date: "2026-08-14",
      status: "PRESENT",
      hoursWorked: 8,
      overtimeHours: 0
    }, adminUser._id.toString(), "SUPER_ADMIN")).rejects.toThrow(/already recorded/i);
  });
});