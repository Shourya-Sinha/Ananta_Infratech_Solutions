Object.defineProperty(exports, "__esModule", {
  value: true
});
var _AuditLog = require("../../db/models/AuditLog");
var _logger = require("../../config/logger");
const SENSITIVE_KEYS = new Set(["passwordHash", "refreshTokenHash", "otp", "token"]);
function redact(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : redact(v);
  }
  return out;
}
exports.AuditService = {
  /**
   * Fire-and-forget-safe audit write: failures are logged but never thrown,
   * because an audit-log outage must not block the underlying business
   * operation that already succeeded. Callers that need a hard guarantee
   * should await this within their own DB transaction instead.
   */
  async log(entry) {
    try {
      await _AuditLog.AuditLog.create({
        actor: entry.actor,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        before: entry.before ? redact(entry.before) : undefined,
        after: entry.after ? redact(entry.after) : undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent
      });
    } catch (err) {
      _logger.logger.error({
        err,
        entry
      }, "Failed to write audit log");
    }
  }
};