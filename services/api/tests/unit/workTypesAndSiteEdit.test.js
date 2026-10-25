"use strict";

/* Default work-type catalogue + site-edit clearing semantics (unit). */

jest.mock("../../src/db/models/User", () => ({ User: { findById: jest.fn() } }));
jest.mock("../../src/db/models/Site", () => ({ Site: { findOne: jest.fn(), findById: jest.fn() } }));
jest.mock("../../src/modules/auditLogs/audit.service", () => ({ AuditService: { log: jest.fn(async () => {}) } }));
jest.mock("../../src/modules/notifications/notification.service", () => ({ NotificationService: { send: jest.fn(async () => {}) } }));
jest.mock("../../src/modules/attendance/attendance.service", () => ({ AttendanceService: {} }));
jest.mock("../../src/modules/workers/worker.service", () => ({ WorkerService: {} }));

const { DEFAULT_WORK_TYPES } = require("@ananta/constants");

describe("default construction work types", () => {
  test("covers the trades an admin expects in the Add Worker dropdown", () => {
    const names = DEFAULT_WORK_TYPES.map((w) => w.name);
    const joined = names.join(" ");
    for (const expected of ["Mason", "Helper", "Foreman", "Carpenter", "Electrician", "Plumber", "Painter", "Welder"]) {
      expect(joined).toContain(expected);
    }
  });
  test("codes are unique and rates plausible (₹300–₹3000/day)", () => {
    expect(new Set(DEFAULT_WORK_TYPES.map((w) => w.code)).size).toBe(DEFAULT_WORK_TYPES.length);
    for (const wt of DEFAULT_WORK_TYPES) {
      expect(wt.code).toBe(wt.code.toUpperCase());
      expect(wt.defaultDailyRate).toBeGreaterThanOrEqual(300);
      expect(wt.defaultDailyRate).toBeLessThanOrEqual(3000);
    }
  });
});

describe("site update: clearing manager / budget / dates", () => {
  const { SiteService } = require("../../src/modules/sites/site.service");
  const { Site } = require("../../src/db/models/Site");
  const { User } = require("../../src/db/models/User");

  test("manager: null unassigns, budget/dates: null clear", async () => {
    const fakeSite = {
      _id: "site1",
      name: "Tower A",
      manager: "mgr1",
      budgetPaise: 5000,
      startDate: new Date(),
      expectedCompletionDate: new Date(),
      save: jest.fn(async () => {}),
      populate: jest.fn(async () => {})
    };
    Site.findById.mockResolvedValue(fakeSite);
    await SiteService.update("site1", { manager: null, budgetRupees: null, startDate: null, expectedCompletionDate: null }, "admin1");
    expect(fakeSite.manager).toBeUndefined();
    expect(fakeSite.budgetPaise).toBeUndefined();
    expect(fakeSite.startDate).toBeUndefined();
    expect(fakeSite.expectedCompletionDate).toBeUndefined();
    expect(fakeSite.save).toHaveBeenCalled();
  });

  test("assigning a manager validates the account is a manager", async () => {
    User.findById.mockReturnValue({ populate: jest.fn(async () => ({ _id: "u1", role: { baseRole: "WORKER" } })) });
    await expect(SiteService.assertManagerExists("u1")).rejects.toThrow(/must be a Manager/);
    User.findById.mockReturnValue({ populate: jest.fn(async () => ({ _id: "u2", role: { baseRole: "MANAGER" } })) });
    await expect(SiteService.assertManagerExists("u2")).resolves.toBeUndefined();
    await expect(SiteService.assertManagerExists(null)).resolves.toBeUndefined();
  });
});
