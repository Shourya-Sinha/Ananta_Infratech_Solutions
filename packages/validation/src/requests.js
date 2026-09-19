Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.kharchiRejectSchema = exports.kharchiCreateSchema = exports.advanceRejectSchema = exports.advanceCreateSchema = exports.advanceApproveSchema = void 0;
var _zod = require("zod");
const advanceCreateSchema = exports.advanceCreateSchema = _zod.z.object({
  worker: _zod.z.string().min(1),
  amountRupees: _zod.z.number().positive().max(1_000_000),
  reason: _zod.z.string().trim().min(3).max(300),
  requestedDate: _zod.z.string().date(),
  attachmentFileId: _zod.z.string().optional()
});
const advanceApproveSchema = exports.advanceApproveSchema = _zod.z.object({
  approvedAmountRupees: _zod.z.number().positive().max(1_000_000)
});
const advanceRejectSchema = exports.advanceRejectSchema = _zod.z.object({
  rejectionReason: _zod.z.string().trim().min(3).max(300)
});
// Super Admin direct add: skips the request/approval cycle entirely. Site is
// optional — the service falls back to the worker's current site for the
// salary-ledger entry. markPaidNow=true (default) records the advance as
// already handed to the worker and posts the salary deduction immediately.
const advanceDirectSchema = exports.advanceDirectSchema = _zod.z.object({
  worker: _zod.z.string().min(1),
  amountRupees: _zod.z.number().positive().max(1_000_000),
  reason: _zod.z.string().trim().min(3).max(300),
  requestedDate: _zod.z.string().date(),
  site: _zod.z.string().min(1).optional(),
  markPaidNow: _zod.z.boolean().optional().default(true)
});
const kharchiCreateSchema = exports.kharchiCreateSchema = _zod.z.object({
  worker: _zod.z.string().min(1),
  site: _zod.z.string().min(1),
  amountRupees: _zod.z.number().positive().max(200_000),
  date: _zod.z.string().date(),
  category: _zod.z.string().trim().min(2).max(80),
  reason: _zod.z.string().trim().min(3).max(300),
  attachmentFileId: _zod.z.string().optional()
});
const kharchiRejectSchema = exports.kharchiRejectSchema = _zod.z.object({
  rejectionReason: _zod.z.string().trim().min(3).max(300)
});
// Super Admin direct add: approves in the same step (Kharchi's approve step
// is what posts the salary deduction), so the amount hits the salary ledger
// immediately. Site is optional — falls back to the worker's current site.
const kharchiDirectSchema = exports.kharchiDirectSchema = _zod.z.object({
  worker: _zod.z.string().min(1),
  amountRupees: _zod.z.number().positive().max(200_000),
  date: _zod.z.string().date(),
  category: _zod.z.string().trim().min(2).max(80),
  reason: _zod.z.string().trim().min(3).max(300),
  site: _zod.z.string().min(1).optional()
});