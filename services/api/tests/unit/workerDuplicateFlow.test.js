jest.mock("../../src/db/models/User", () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn()
  }
}));
jest.mock("../../src/db/models/WorkerProfile", () => ({
  WorkerProfile: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn()
  }
}));
jest.mock("../../src/db/models/WorkType", () => ({
  WorkType: { findById: jest.fn() }
}));
jest.mock("../../src/db/models/Site", () => ({
  Site: { findById: jest.fn(), find: jest.fn() }
}));
jest.mock("../../src/db/models/SiteAssignment", () => ({
  SiteAssignment: { findOne: jest.fn(), create: jest.fn() }
}));
jest.mock("../../src/db/models/Document", () => ({
  DocumentModel: { countDocuments: jest.fn() }
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
jest.mock("../../src/modules/workers/employeeId.util", () => ({
  generateEmployeeId: jest.fn(async () => "EMP-9999")
}));
jest.mock("../../src/modules/users/user.service", () => ({
  UserService: { create: jest.fn() }
}));

const { User } = require("../../src/db/models/User");
const { WorkerProfile } = require("../../src/db/models/WorkerProfile");
const { WorkType } = require("../../src/db/models/WorkType");
const { DocumentModel } = require("../../src/db/models/Document");
const { UserService } = require("../../src/modules/users/user.service");
const { WorkerService } = require("../../src/modules/workers/worker.service");
const { ERROR_CODES } = require("../../src/errors/AppError");

const actorId = "507f1f77bcf86cd799439099";
const workTypeId = "507f1f77bcf86cd799439011";

/**
 * The service reads accounts via User.findOne(...).populate("role") — this
 * helper queues return values for those chained lookups (each entry is the
 * populated result of one findOne call).
 */
function userFindOneReturns(...values) {
  const queue = [...values];
  // findOne(...) is awaited directly in some code paths and chained with
  // .populate("role") in others — return a promise that carries .populate.
  User.findOne.mockImplementation(() => {
    const v = queue.length > 1 ? queue.shift() : queue[0];
    const p = Promise.resolve(v);
    p.populate = async () => v;
    return p;
  });
}

function makeDoc(overrides = {}) {
  return {
    _id: "507f1f77bcf86cd799439044",
    save: jest.fn(async () => {}),
    ...overrides
  };
}

const input = {
  name: "New Name",
  phone: "9876500000",
  email: "new@example.com",
  workTypeId
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("WorkerService.registerByAdmin duplicate handling", () => {
  test("fresh phone/email → normal registration (no duplicate logic)", async () => {
    userFindOneReturns(null); // phone lookup
    const savedUser = makeDoc({ name: "New Name", phone: input.phone, role: { key: "WORKER" } });
    UserService.create.mockResolvedValueOnce({ user: savedUser, temporaryPassword: "Secret123" });
    User.findById.mockResolvedValueOnce(savedUser);
    WorkerProfile.findOne.mockResolvedValueOnce(null); // no profile yet (selectWorkType)
    WorkType.findById.mockResolvedValueOnce({ _id: workTypeId, isActive: true });
    const createdProfile = makeDoc({ employeeId: "EMP-9999", workType: workTypeId });
    WorkerProfile.create.mockResolvedValueOnce(createdProfile);

    const result = await WorkerService.registerByAdmin(input, actorId);
    expect(result.updatedExisting).toBe(false);
    expect(result.profile.employeeId).toBe("EMP-9999");
    expect(UserService.create).toHaveBeenCalledTimes(1);
  });

  test("phone exists on UNVERIFIED worker without confirmation → 409 warning with details, nothing written", async () => {
    const existingUser = makeDoc({
      name: "Ramesh Kumar",
      phone: input.phone,
      email: "old@example.com",
      status: "ACTIVE",
      role: { key: "WORKER" }
    });
    const existingProfile = makeDoc({
      employeeId: "EMP-0007",
      verificationStatus: "PENDING_VERIFICATION"
    });
    userFindOneReturns(existingUser);
    WorkerProfile.findOne.mockResolvedValue(existingProfile);
    DocumentModel.countDocuments.mockResolvedValue(0);

    await expect(WorkerService.registerByAdmin(input, actorId)).rejects.toMatchObject({
      code: ERROR_CODES.CONFLICT,
      statusCode: 409,
      details: {
        kind: "DUPLICATE_WORKER",
        matches: { phone: true, email: false },
        existing: {
          employeeId: "EMP-0007",
          name: "Ramesh Kumar",
          documentsVerified: false
        }
      }
    });
    // Nothing was created or updated.
    expect(UserService.create).not.toHaveBeenCalled();
    expect(existingUser.save).not.toHaveBeenCalled();
    expect(existingProfile.save).not.toHaveBeenCalled();
  });

  test("phone exists on DOCUMENT-VERIFIED worker → hard 'already exists' error even with confirmation", async () => {
    const existingUser = makeDoc({ name: "Suresh", phone: input.phone, role: { key: "WORKER" } });
    const existingProfile = makeDoc({
      employeeId: "EMP-0003",
      verificationStatus: "ACTIVE"
    });
    userFindOneReturns(existingUser);
    WorkerProfile.findOne.mockResolvedValue(existingProfile);
    DocumentModel.countDocuments.mockResolvedValue(2);

    for (const confirm of [undefined, true]) {
      await expect(
        WorkerService.registerByAdmin({ ...input, confirmDuplicate: confirm }, actorId)
      ).rejects.toMatchObject({
        code: ERROR_CODES.CONFLICT,
        statusCode: 409,
        details: { kind: "DUPLICATE_WORKER_VERIFIED" }
      });
    }
    expect(existingUser.save).not.toHaveBeenCalled();
  });

  test("confirmed duplicate → existing account UPDATED in place (same profile, new data, new password)", async () => {
    const existingUser = makeDoc({
      name: "Ramesh Kumar",
      phone: input.phone,
      email: "old@example.com",
      status: "SUSPENDED",
      role: { key: "WORKER" }
    });
    const existingProfile = makeDoc({
      employeeId: "EMP-0007",
      verificationStatus: "PENDING_VERIFICATION",
      workType: "old-work-type"
    });
    userFindOneReturns(existingUser, null); // 1st: phone match; 2nd: email-unique guard
    WorkerProfile.findOne.mockResolvedValue(existingProfile);
    DocumentModel.countDocuments.mockResolvedValue(0);
    WorkType.findById.mockResolvedValue({ _id: workTypeId, isActive: true });

    const result = await WorkerService.registerByAdmin({ ...input, confirmDuplicate: true }, actorId);

    expect(result.updatedExisting).toBe(true);
    expect(result.temporaryPassword).toBeTruthy();
    expect(result.profile).toBe(existingProfile); // SAME profile doc — history kept
    expect(existingUser.name).toBe("New Name"); // account data replaced
    expect(existingUser.phone).toBe(input.phone);
    expect(existingUser.email).toBe("new@example.com");
    expect(existingUser.status).toBe("ACTIVE"); // suspended account re-activated
    expect(existingUser.passwordHash).toBeTruthy(); // fresh password hashed
    expect(existingProfile.workType).toBe(workTypeId);
    expect(existingProfile.save).toHaveBeenCalled();
    expect(UserService.create).not.toHaveBeenCalled(); // never a second account
  });

  test("confirmed duplicate where the email belongs to a DIFFERENT account → 409 EMAIL_TAKEN", async () => {
    const existingUser = makeDoc({ name: "Ramesh", phone: input.phone, role: { key: "WORKER" } });
    const otherUser = { _id: "507f1f77bcf86cd799439055" };
    const existingProfile = makeDoc({ employeeId: "EMP-0007", verificationStatus: "PENDING_VERIFICATION" });
    userFindOneReturns(existingUser, otherUser); // phone match, then email owned by someone else
    WorkerProfile.findOne.mockResolvedValue(existingProfile);
    DocumentModel.countDocuments.mockResolvedValue(0);

    await expect(
      WorkerService.registerByAdmin({ ...input, confirmDuplicate: true }, actorId)
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONFLICT,
      details: { kind: "EMAIL_TAKEN" }
    });
    expect(existingUser.save).not.toHaveBeenCalled();
  });
});

describe("WorkerService.checkDuplicate (pre-flight)", () => {
  test("no account → duplicate:false", async () => {
    userFindOneReturns(null);
    const result = await WorkerService.checkDuplicate({ phone: "9812345678" });
    expect(result.duplicate).toBe(false);
    expect(result.canOverwrite).toBe(false);
  });

  test("unverified worker → duplicate with canOverwrite:true and a warning message naming the owner", async () => {
    const existingUser = makeDoc({ name: "Ramesh Kumar", phone: "9876500000", role: { key: "WORKER" } });
    userFindOneReturns(existingUser);
    WorkerProfile.findOne.mockResolvedValueOnce(makeDoc({ employeeId: "EMP-0007", verificationStatus: "PENDING_VERIFICATION" }));
    DocumentModel.countDocuments.mockResolvedValueOnce(0);

    const result = await WorkerService.checkDuplicate({ phone: "9876500000" });
    expect(result.duplicate).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.canOverwrite).toBe(true);
    expect(result.message).toContain("Ramesh Kumar");
    expect(result.message).toContain("EMP-0007");
  });

  test("verified worker → duplicate with canOverwrite:false (hard error path)", async () => {
    const existingUser = makeDoc({ name: "Suresh", phone: "9876500000", role: { key: "WORKER" } });
    userFindOneReturns(existingUser);
    WorkerProfile.findOne.mockResolvedValueOnce(makeDoc({ employeeId: "EMP-0003", verificationStatus: "ACTIVE" }));
    DocumentModel.countDocuments.mockResolvedValueOnce(1);

    const result = await WorkerService.checkDuplicate({ phone: "9876500000" });
    expect(result.duplicate).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.canOverwrite).toBe(false);
    expect(result.message).toContain("already exists");
  });

  test("duplicate hit on a non-worker account (e.g. MANAGER) → cannot be reused", async () => {
    const existingUser = makeDoc({ name: "Manager Ji", phone: "9876500000", role: { key: "MANAGER" } });
    userFindOneReturns(existingUser);
    WorkerProfile.findOne.mockResolvedValueOnce(null);
    DocumentModel.countDocuments.mockResolvedValueOnce(0);

    const result = await WorkerService.checkDuplicate({ phone: "9876500000" });
    expect(result.duplicate).toBe(true);
    expect(result.canOverwrite).toBe(false);
    expect(result.message).toContain("MANAGER");
  });
});
