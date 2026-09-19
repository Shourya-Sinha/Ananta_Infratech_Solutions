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