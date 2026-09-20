Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DUPLICATE_ACTIONS = exports.VERIFIED_STATUSES = void 0;
exports.isWorkerDocumentVerified = isWorkerDocumentVerified;
exports.decideDuplicateRegistration = decideDuplicateRegistration;
/**
 * PURE duplicate-registration policy (no DB access — unit-testable, see
 * tests/unit/workerDuplicatePolicy.test.js).
 *
 * When an admin registers a worker whose phone/email ALREADY exists:
 *
 *  1. Existing worker is document-verified  -> BLOCK. Hard error: "phone or
 *     email already exists". The verified account is never overwritten.
 *  2. Existing worker is NOT verified yet and the admin has NOT confirmed
 *     -> WARN. The API returns a 409 carrying full duplicate details so the
 *     Admin UI can show exactly WHICH number/email is already registered
 *     and ask whether to proceed. Nothing is written.
 *  3. Admin confirmed (confirmDuplicate=true) -> UPDATE_EXISTING. The
 *     existing account is updated in place with the new data (same
 *     employee id, history preserved) and registration returns normally.
 */

const DUPLICATE_ACTIONS = exports.DUPLICATE_ACTIONS = {
  PROCEED_NEW: "PROCEED_NEW",
  WARN_CONFIRM_REQUIRED: "WARN_CONFIRM_REQUIRED",
  BLOCK_VERIFIED: "BLOCK_VERIFIED",
  UPDATE_EXISTING: "UPDATE_EXISTING"
};
// A worker counts as "document verified" once the profile moved past
// PENDING_VERIFICATION, OR at least one of their documents was individually
// marked VERIFIED (covers mid-workflow states).
const VERIFIED_STATUSES = exports.VERIFIED_STATUSES = ["DOCUMENT_VERIFIED", "WORK_TYPE_VERIFIED", "ACTIVE"];
function isWorkerDocumentVerified(existing) {
  if (!existing) return false;
  if (VERIFIED_STATUSES.includes(existing.verificationStatus)) return true;
  return (existing.verifiedDocumentCount ?? 0) > 0;
}
function describeMatches(matches) {
  const parts = [];
  if (matches.phone) parts.push("phone number");
  if (matches.email) parts.push("email");
  return parts.join(" and ");
}
function decisionMessage(action, matches, existing) {
  const field = describeMatches(matches);
  const who = existing ? `${existing.name} (Employee ID ${existing.employeeId ?? "pending"})` : "an existing account";
  if (action === DUPLICATE_ACTIONS.BLOCK_VERIFIED) {
    return `Cannot register: this ${field} already belongs to ${who}, whose documents are already verified. This phone number or email already exists in the system.`;
  }
  if (action === DUPLICATE_ACTIONS.WARN_CONFIRM_REQUIRED) {
    return `Warning: this ${field} is already registered to ${who}. That worker's documents are NOT verified yet. If you proceed, the EXISTING account will be updated with the new data you entered (same employee ID, history kept). Do you still want to register with this ${field}?`;
  }
  return "";
}
/**
 * @param {object} params
 * @param {{phone: boolean, email: boolean}} params.matches  which fields hit an existing account
 * @param {boolean} params.confirmDuplicate  admin explicitly accepted the overwrite warning
 * @param {{name?: string, employeeId?: string, verificationStatus?: string, verifiedDocumentCount?: number}|null} params.existing
 * @returns {{action: string, message: string}}
 */
function decideDuplicateRegistration(params) {
  const matches = params.matches ?? {};
  const existing = params.existing ?? null;
  const anyMatch = Boolean(matches.phone || matches.email);
  if (!anyMatch) {
    return {
      action: DUPLICATE_ACTIONS.PROCEED_NEW,
      message: ""
    };
  }
  const verified = isWorkerDocumentVerified(existing);
  if (verified) {
    return {
      action: DUPLICATE_ACTIONS.BLOCK_VERIFIED,
      message: decisionMessage(DUPLICATE_ACTIONS.BLOCK_VERIFIED, matches, existing)
    };
  }
  if (!params.confirmDuplicate) {
    return {
      action: DUPLICATE_ACTIONS.WARN_CONFIRM_REQUIRED,
      message: decisionMessage(DUPLICATE_ACTIONS.WARN_CONFIRM_REQUIRED, matches, existing)
    };
  }
  return {
    action: DUPLICATE_ACTIONS.UPDATE_EXISTING,
    message: ""
  };
}
