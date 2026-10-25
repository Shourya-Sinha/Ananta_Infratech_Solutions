"use strict";

/*
 * Real-time finance: emitFinanceUpdate must fan the unified
 * `finance:updated` event out to admin + affected site + affected worker
 * rooms, and must never throw into the mutation that triggered it.
 */
const mockEmitCalls = [];
const mockRoomCalls = [];
let mockIoShouldThrow = false;

jest.mock("../../src/sockets/gateway", () => ({
  getIO: () => {
    if (mockIoShouldThrow) throw new Error("socket not initialised");
    const target = {
      to: (room) => { mockRoomCalls.push(room); return target; },
      emit: (event, payload) => { mockEmitCalls.push({ event, payload }); }
    };
    return target;
  }
}));

const { emitFinanceUpdate } = require("../../src/sockets/financeEvents");

beforeEach(() => { mockEmitCalls.length = 0; mockRoomCalls.length = 0; mockIoShouldThrow = false; });

describe("emitFinanceUpdate", () => {
  test("fans out to admin, site and worker rooms with a structured payload", () => {
    emitFinanceUpdate({ reason: "SALARY_RATE_UPDATED", workerId: "w1", siteId: "s1", month: "2026-10" });
    expect(mockRoomCalls).toEqual(["admin", "site:s1", "worker:w1"]);
    expect(mockEmitCalls).toHaveLength(1);
    expect(mockEmitCalls[0].event).toBe("finance:updated");
    expect(mockEmitCalls[0].payload).toMatchObject({ reason: "SALARY_RATE_UPDATED", workerId: "w1", siteId: "s1", month: "2026-10" });
    expect(typeof mockEmitCalls[0].payload.at).toBe("string");
  });

  test("admin-only when no worker/site is affected (e.g. company expense)", () => {
    emitFinanceUpdate({ reason: "COMPANY_EXPENSE_ADDED" });
    expect(mockRoomCalls).toEqual(["admin"]);
    expect(mockEmitCalls[0].payload.workerId).toBeNull();
  });

  test("ObjectId-like ids are stringified", () => {
    const fakeId = { toString: () => "507f1f77bcf86cd799439011" };
    emitFinanceUpdate({ reason: "ADVANCE_PAID", workerId: fakeId });
    expect(mockRoomCalls).toContain("worker:507f1f77bcf86cd799439011");
  });

  test("never throws when the socket gateway is down (tests/scripts)", () => {
    mockIoShouldThrow = true;
    expect(() => emitFinanceUpdate({ reason: "ANY" })).not.toThrow();
  });
});
