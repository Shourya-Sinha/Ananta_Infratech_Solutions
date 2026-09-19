var _requests = require("@ananta/validation");
var _constants = require("@ananta/constants");
// Super Admin "direct add" schemas + permission registry coverage. These are
// pure-function tests (no DB), so they run everywhere — unlike the
// attendance→ledger→payroll integration test which needs a MongoDB binary.
describe("advanceDirectSchema (Super Admin direct add)", () => {
  const valid = {
    worker: "507f1f77bcf86cd799439011",
    amountRupees: 5000,
    reason: "Festival advance paid at site",
    requestedDate: "2026-09-19"
  };
  test("accepts a minimal payload and defaults markPaidNow to true", () => {
    const parsed = _requests.advanceDirectSchema.parse(valid);
    expect(parsed.markPaidNow).toBe(true);
    expect(parsed.site).toBeUndefined();
  });
  test("honours markPaidNow=false (approve now, deduct when marked paid)", () => {
    const parsed = _requests.advanceDirectSchema.parse({
      ...valid,
      markPaidNow: false,
      site: "507f1f77bcf86cd799439012"
    });
    expect(parsed.markPaidNow).toBe(false);
    expect(parsed.site).toBe("507f1f77bcf86cd799439012");
  });
  test.each([["zero amount", {
    ...valid,
    amountRupees: 0
  }], ["negative amount", {
    ...valid,
    amountRupees: -100
  }], ["short reason", {
    ...valid,
    reason: "ab"
  }], ["missing worker", {
    ...valid,
    worker: undefined
  }]])("rejects %s", (_label, payload) => {
    expect(() => _requests.advanceDirectSchema.parse(payload)).toThrow();
  });
});
describe("kharchiDirectSchema (Super Admin direct add)", () => {
  const valid = {
    worker: "507f1f77bcf86cd799439011",
    amountRupees: 120,
    date: "2026-09-19",
    category: "Food",
    reason: "Tea and snacks for the gang"
  };
  test("accepts a payload with optional site", () => {
    const parsed = _requests.kharchiDirectSchema.parse(valid);
    expect(parsed.site).toBeUndefined();
    const withSite = _requests.kharchiDirectSchema.parse({
      ...valid,
      site: "507f1f77bcf86cd799439012"
    });
    expect(withSite.site).toBe("507f1f77bcf86cd799439012");
  });
  test.each([["missing category", {
    ...valid,
    category: ""
  }], ["zero amount", {
    ...valid,
    amountRupees: 0
  }]])("rejects %s", (_label, payload) => {
    expect(() => _requests.kharchiDirectSchema.parse(payload)).toThrow();
  });
});
describe("direct-add permission registry", () => {
  test("registers advance.directAdd and kharchi.directAdd", () => {
    const keys = _constants.PERMISSIONS.map((p) => p.key);
    expect(keys).toContain("advance.directAdd");
    expect(keys).toContain("kharchi.directAdd");
  });
  test("grants direct add to SUPER_ADMIN only by default", () => {
    const superAdmin = new Set(_constants.DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN);
    const manager = new Set(_constants.DEFAULT_ROLE_PERMISSIONS.MANAGER);
    const worker = new Set(_constants.DEFAULT_ROLE_PERMISSIONS.WORKER);
    expect(superAdmin.has("advance.directAdd")).toBe(true);
    expect(superAdmin.has("kharchi.directAdd")).toBe(true);
    expect(manager.has("advance.directAdd")).toBe(false);
    expect(manager.has("kharchi.directAdd")).toBe(false);
    expect(worker.has("advance.directAdd")).toBe(false);
    expect(worker.has("kharchi.directAdd")).toBe(false);
  });
});
