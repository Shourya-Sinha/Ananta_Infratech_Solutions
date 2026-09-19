var _workers = require("@ananta/validation");
var _constants = require("@ananta/constants");
// Super Admin "Add worker" (web registration) + per-document verification
// schemas. Pure-function tests (no DB), so they run everywhere — unlike the
// attendance→ledger→payroll integration test which needs a MongoDB binary.
describe("workerRegisterSchema (Super Admin web registration)", () => {
  const valid = {
    name: "Ramesh Kumar",
    phone: "9876543210",
    workTypeId: "507f1f77bcf86cd799439011"
  };
  test("accepts a minimal payload (email/site/password optional)", () => {
    const parsed = _workers.workerRegisterSchema.parse(valid);
    expect(parsed.email).toBeUndefined();
    expect(parsed.siteId).toBeUndefined();
    expect(parsed.password).toBeUndefined();
  });
  test("accepts the full payload with every optional field", () => {
    const parsed = _workers.workerRegisterSchema.parse({
      ...valid,
      email: "ramesh@example.com",
      siteId: "507f1f77bcf86cd799439012",
      password: "Sup3rSecret"
    });
    expect(parsed.email).toBe("ramesh@example.com");
    expect(parsed.siteId).toBe("507f1f77bcf86cd799439012");
    expect(parsed.password).toBe("Sup3rSecret");
  });
  test.each([["missing name", {
    ...valid,
    name: undefined
  }], ["one-character name", {
    ...valid,
    name: "R"
  }], ["invalid phone", {
    ...valid,
    phone: "12345"
  }], ["missing workTypeId", {
    ...valid,
    workTypeId: undefined
  }], ["weak password", {
    ...valid,
    password: "weakpass"
  }]])("rejects %s", (_label, payload) => {
    expect(() => _workers.workerRegisterSchema.parse(payload)).toThrow();
  });
});
describe("documentVerifySchema (per-document verification)", () => {
  test("accepts an approval without a reason", () => {
    const parsed = _workers.documentVerifySchema.parse({
      approve: true
    });
    expect(parsed.approve).toBe(true);
    expect(parsed.rejectionReason).toBeUndefined();
  });
  test("accepts a rejection with a reason", () => {
    const parsed = _workers.documentVerifySchema.parse({
      approve: false,
      rejectionReason: "Photo unreadable, please re-upload"
    });
    expect(parsed.approve).toBe(false);
    expect(parsed.rejectionReason).toBe("Photo unreadable, please re-upload");
  });
  test.each([["a rejection without a reason", {
    approve: false
  }], ["a rejection with a too-short reason", {
    approve: false,
    rejectionReason: "no"
  }]])("rejects %s", (_label, payload) => {
    expect(() => _workers.documentVerifySchema.parse(payload)).toThrow();
  });
});
describe("worker registration permission registry", () => {
  test("SUPER_ADMIN holds worker.create and worker.verify by default", () => {
    const superAdmin = new Set(_constants.DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN);
    expect(superAdmin.has("worker.create")).toBe(true);
    expect(superAdmin.has("worker.verify")).toBe(true);
  });
  test("MANAGER may register workers (worker.create) but not verify documents (worker.verify)", () => {
    const manager = new Set(_constants.DEFAULT_ROLE_PERMISSIONS.MANAGER);
    expect(manager.has("worker.create")).toBe(true);
    expect(manager.has("worker.verify")).toBe(false);
  });
});