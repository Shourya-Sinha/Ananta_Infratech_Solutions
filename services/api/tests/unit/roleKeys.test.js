jest.mock("../../src/modules/auditLogs/audit.service", () => ({ AuditService: { log: jest.fn() } }));
jest.mock("../../src/modules/permissions/permission.service", () => ({ PermissionService: { invalidateCache: jest.fn() } }));

const { ROLE_KEY_PATTERN } = require("../../src/db/models/Role");
const { RoleService } = require("../../src/modules/permissions/role.service");

describe("custom role keys", () => {
  it("accepts upper-case keys of 3-40 chars", () => {
    expect(ROLE_KEY_PATTERN.test("SITE_SUPERVISOR")).toBe(true);
    expect(ROLE_KEY_PATTERN.test("ACCOUNTS2")).toBe(true);
  });

  it("rejects bad keys", () => {
    expect(ROLE_KEY_PATTERN.test("ab")).toBe(false);
    expect(ROLE_KEY_PATTERN.test("2FAST")).toBe(false);
    expect(ROLE_KEY_PATTERN.test("has space")).toBe(false);
    expect(ROLE_KEY_PATTERN.test("A".repeat(41))).toBe(false);
  });

  it("derives a key from a label", () => {
    expect(RoleService.deriveKey("  Site Supervisor!! ")).toBe("SITE_SUPERVISOR");
    expect(RoleService.deriveKey("Accounts & Payroll")).toBe("ACCOUNTS_PAYROLL");
  });

  it("only a Super Admin can grant a SUPER_ADMIN-base role", () => {
    expect(() => RoleService.assertActorCanUseBase("MANAGER", "SUPER_ADMIN")).toThrow(/Super Admin/);
    expect(() => RoleService.assertActorCanUseBase("SUPER_ADMIN", "SUPER_ADMIN")).not.toThrow();
    expect(() => RoleService.assertActorCanUseBase("MANAGER", "WORKER")).not.toThrow();
  });

  it("blocks granting permissions the actor does not hold, except Super Admin", () => {
    const manager = { baseRole: "MANAGER", permissions: new Set(["attendance.read"]) };
    expect(() => RoleService.assertCanGrantAll(manager, new Set(["attendance.read"]))).not.toThrow();
    expect(() => RoleService.assertCanGrantAll(manager, new Set(["salary.read"]))).toThrow(/salary.read/);
    const admin = { baseRole: "SUPER_ADMIN", permissions: new Set() };
    expect(() => RoleService.assertCanGrantAll(admin, new Set(["salary.read"]))).not.toThrow();
  });
});
