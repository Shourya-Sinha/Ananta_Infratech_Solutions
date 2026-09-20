Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SOCKET_EVENTS = exports.ROOMS = void 0;
// The full WebSocket event catalog. Importing this everywhere guarantees the server
// emits exactly the event names the clients listen for — no string typos across apps.

const SOCKET_EVENTS = exports.SOCKET_EVENTS = {
  AUTH_SESSION_UPDATED: "auth:session_updated",
  USER_CREATED: "user:created",
  USER_UPDATED: "user:updated",
  USER_VERIFIED: "user:verified",
  USER_STATUS_CHANGED: "user:status_changed",
  WORKER_CREATED: "worker:created",
  WORKER_UPDATED: "worker:updated",
  WORKER_SITE_ASSIGNED: "worker:site_assigned",
  WORKER_WORK_TYPE_UPDATED: "worker:work_type_updated",
  WORKER_VERIFICATION_UPDATED: "worker:verification_updated",
  ATTENDANCE_CREATED: "attendance:created",
  ATTENDANCE_UPDATED: "attendance:updated",
  ATTENDANCE_APPROVED: "attendance:approved",
  SALARY_RECALCULATED: "salary:recalculated",
  SALARY_LEDGER_UPDATED: "salary:ledger_updated",
  SALARY_MONTH_FINALIZED: "salary:month_finalized",
  ADVANCE_CREATED: "advance:created",
  ADVANCE_APPROVED: "advance:approved",
  ADVANCE_REJECTED: "advance:rejected",
  ADVANCE_PAID: "advance:paid",
  KHARCHI_CREATED: "kharchi:created",
  KHARCHI_APPROVED: "kharchi:approved",
  KHARCHI_REJECTED: "kharchi:rejected",
  SITE_CREATED: "site:created",
  SITE_UPDATED: "site:updated",
  SITE_CAPITAL_UPDATED: "site:capital_updated",
  SITE_INVESTMENT_ADDED: "site:investment_added",
  SITE_INVESTMENT_REVERSED: "site:investment_reversed",
  SITE_INCOME_ADDED: "site:income_added",
  SITE_EXPENSE_ADDED: "site:expense_added",
  SITE_PROFIT_UPDATED: "site:profit_updated",
  NOTIFICATION_NEW: "notification:new",
  NOTIFICATION_READ: "notification:read",
  CHAT_MESSAGE: "chat:message",
  CHAT_TYPING: "chat:typing",
  CHAT_READ: "chat:read",
  SYSTEM_MAINTENANCE: "system:maintenance",
  SYSTEM_CONFIGURATION_UPDATED: "system:configuration_updated"
};

// Rooms are computed with these helpers so the naming convention never drifts.
const ROOMS = exports.ROOMS = {
  admin: () => "admin",
  manager: userId => `manager:${userId}`,
  site: siteId => `site:${siteId}`,
  worker: workerId => `worker:${workerId}`,
  user: userId => `user:${userId}`
};