"use strict";

/**
 * Unified real-time finance signal.
 *
 * Every mutation that moves money — wage/salary-rate edits, attendance
 * earnings, advances, Kharchi, site income/expense/investment/billing,
 * company expenses, payroll — calls emitFinanceUpdate() so ALL connected
 * clients (Super Admin web, Manager/Worker mobile) refresh their salary,
 * payroll and finance totals immediately over WebSocket, with no manual
 * reload. Specialised events (advance:created, site:profit_updated, …)
 * keep firing as before; this is the single "finance changed" heartbeat
 * on top of them.
 *
 * Delivery: admin room (Super Admins) + the affected site's room
 * (its manager and assigned workers) + the affected worker's room.
 * Emission is fire-and-forget and can never break the mutation itself
 * (socket may be uninitialised in tests/scripts). The gateway is required
 * lazily so importing this module never pulls socket/env config into
 * unit tests or scripts.
 */
const { ROOMS, SOCKET_EVENTS } = require("@ananta/shared-types");

function emitToRooms(event, payload, { workerId, siteId } = {}) {
  try {
    const { getIO } = require("./gateway");
    let target = getIO().to(ROOMS.admin());
    if (siteId) target = target.to(ROOMS.site(siteId.toString()));
    if (workerId) target = target.to(ROOMS.worker(workerId.toString()));
    target.emit(event, payload);
  } catch {
    // Socket gateway not initialised — live updates are best-effort;
    // the mutation itself has already succeeded.
  }
}

function emitFinanceUpdate({ reason, workerId, siteId, month } = {}) {
  emitToRooms(
    SOCKET_EVENTS.FINANCE_UPDATED,
    {
      reason: reason ?? "FINANCE_CHANGE",
      workerId: workerId ? workerId.toString() : null,
      siteId: siteId ? siteId.toString() : null,
      month: month ?? null,
      at: new Date().toISOString()
    },
    { workerId, siteId }
  );
}

module.exports = { emitFinanceUpdate, emitToRooms };
