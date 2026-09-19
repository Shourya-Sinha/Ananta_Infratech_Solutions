Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PERMISSION_KEYS = exports.PERMISSIONS = exports.DEFAULT_ROLE_PERMISSIONS = void 0;
// PERMISSION REGISTRY — single source of truth.
// The RBAC middleware, the DB seeder, and the Admin "Permission Management" UI
// all read from this list. Never write a raw permission-key string anywhere else.

const PERMISSIONS = exports.PERMISSIONS = [
// Users
{
  key: "user.create",
  group: "User",
  description: "Create user accounts"
}, {
  key: "user.read",
  group: "User",
  description: "View user accounts"
}, {
  key: "user.update",
  group: "User",
  description: "Edit user accounts"
}, {
  key: "user.delete",
  group: "User",
  description: "Delete/deactivate user accounts"
}, {
  key: "user.verify",
  group: "User",
  description: "Verify a user's identity/account"
},
// Workers
{
  key: "worker.create",
  group: "Worker",
  description: "Register a new worker"
}, {
  key: "worker.read",
  group: "Worker",
  description: "View worker profiles"
}, {
  key: "worker.update",
  group: "Worker",
  description: "Edit worker profile fields"
}, {
  key: "worker.delete",
  group: "Worker",
  description: "Remove a worker profile"
}, {
  key: "worker.verify",
  group: "Worker",
  description: "Verify worker documents / work type"
}, {
  key: "worker.assignSite",
  group: "Worker",
  description: "Assign or transfer a worker's site"
}, {
  key: "worker.changeWorkType",
  group: "Worker",
  description: "Change a worker's work type"
},
// Attendance
{
  key: "attendance.create",
  group: "Attendance",
  description: "Record attendance"
}, {
  key: "attendance.update",
  group: "Attendance",
  description: "Edit/correct attendance"
}, {
  key: "attendance.read",
  group: "Attendance",
  description: "View attendance records"
},
// Salary / Payroll
{
  key: "salary.read",
  group: "Salary",
  description: "View salary ledger and summaries"
}, {
  key: "salary.calculate",
  group: "Salary",
  description: "Trigger payroll calculation"
}, {
  key: "salary.manage",
  group: "Salary",
  description: "Finalize payroll, post adjustments"
},
// Advance
{
  key: "advance.create",
  group: "Advance",
  description: "Submit an advance request"
}, {
  key: "advance.approve",
  group: "Advance",
  description: "Approve an advance request"
}, {
  key: "advance.reject",
  group: "Advance",
  description: "Reject an advance request"
}, {
  key: "advance.read",
  group: "Advance",
  description: "View advance requests"
},
{
  key: "advance.directAdd",
  group: "Advance",
  description: "Directly add an advance for any worker without a request (Super Admin)"
},
// Kharchi
{
  key: "kharchi.create",
  group: "Kharchi",
  description: "Submit a Kharchi request"
}, {
  key: "kharchi.approve",
  group: "Kharchi",
  description: "Approve a Kharchi request"
}, {
  key: "kharchi.reject",
  group: "Kharchi",
  description: "Reject a Kharchi request"
}, {
  key: "kharchi.read",
  group: "Kharchi",
  description: "View Kharchi requests"
},
{
  key: "kharchi.directAdd",
  group: "Kharchi",
  description: "Directly add a Kharchi for any worker without a request (Super Admin)"
},
// Sites
{
  key: "site.create",
  group: "Site",
  description: "Create construction sites"
}, {
  key: "site.update",
  group: "Site",
  description: "Edit site details"
}, {
  key: "site.delete",
  group: "Site",
  description: "Delete/archive a site"
}, {
  key: "site.read",
  group: "Site",
  description: "View site information"
},
// Site finance
{
  key: "site.expense.create",
  group: "Finance",
  description: "Record a site expense"
}, {
  key: "site.expense.update",
  group: "Finance",
  description: "Edit a site expense"
}, {
  key: "site.expense.delete",
  group: "Finance",
  description: "Delete/reverse a site expense"
}, {
  key: "site.income.create",
  group: "Finance",
  description: "Record site income"
}, {
  key: "site.income.update",
  group: "Finance",
  description: "Edit site income"
}, {
  key: "site.income.delete",
  group: "Finance",
  description: "Delete/reverse site income"
}, {
  key: "site.capital.manage",
  group: "Finance",
  description: "Record/manage site capital injections"
}, {
  key: "financialReports.read",
  group: "Finance",
  description: "View company-wide financial reports"
},
// Audit
{
  key: "auditLogs.read",
  group: "Audit",
  description: "View audit logs"
},
// Comms
{
  key: "support.chat",
  group: "Support",
  description: "Use support chat"
}, {
  key: "notification.manage",
  group: "Notification",
  description: "Manage notification settings"
},
// Permissions themselves
{
  key: "permission.manage",
  group: "Permission",
  description: "Edit role permission matrix"
}];
const PERMISSION_KEYS = exports.PERMISSION_KEYS = PERMISSIONS.map(p => p.key);

// Default RolePermission seed. MANAGER's optional ones are explicitly off by default (§6 of spec).
const DEFAULT_ROLE_PERMISSIONS = exports.DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSION_KEYS,
  // full access
  MANAGER: ["worker.create", "worker.read", "attendance.create", "attendance.read", "advance.create", "advance.read", "kharchi.create", "kharchi.read", "site.read", "support.chat"],
  WORKER: ["worker.read", "attendance.read", "salary.read", "advance.create", "advance.read", "kharchi.create", "kharchi.read", "support.chat"]
};