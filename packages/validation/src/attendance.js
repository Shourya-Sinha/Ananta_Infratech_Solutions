Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.attendanceCreateSchema = exports.attendanceCorrectionSchema = exports.attendanceBulkSchema = void 0;
var _zod = require("zod");
var _sharedTypes = require("@ananta/shared-types");
const attendanceCreateSchema = exports.attendanceCreateSchema = _zod.z.object({
  worker: _zod.z.string().min(1),
  site: _zod.z.string().min(1),
  date: _zod.z.string().date(),
  // "YYYY-MM-DD"
  status: _zod.z.enum(_sharedTypes.ATTENDANCE_STATUS),
  hoursWorked: _zod.z.number().min(0, "hoursWorked cannot be negative").max(24, "hoursWorked cannot exceed 24").default(0),
  overtimeHours: _zod.z.number().min(0, "overtimeHours cannot be negative").max(24, "overtimeHours cannot exceed 24").default(0)
});
const attendanceBulkSchema = exports.attendanceBulkSchema = _zod.z.object({
  site: _zod.z.string().min(1),
  date: _zod.z.string().date(),
  entries: _zod.z.array(_zod.z.object({
    worker: _zod.z.string().min(1),
    status: _zod.z.enum(_sharedTypes.ATTENDANCE_STATUS),
    hoursWorked: _zod.z.number().min(0).max(24).default(0),
    overtimeHours: _zod.z.number().min(0).max(24).default(0)
  })).min(1).max(500)
});
const attendanceCorrectionSchema = exports.attendanceCorrectionSchema = _zod.z.object({
  correctionOf: _zod.z.string().min(1),
  status: _zod.z.enum(_sharedTypes.ATTENDANCE_STATUS),
  hoursWorked: _zod.z.number().min(0).max(24),
  overtimeHours: _zod.z.number().min(0).max(24),
  reason: _zod.z.string().trim().min(5).max(500)
});