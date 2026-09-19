Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.attendanceRouter = void 0;
var _express = require("express");
var _attendance = require("./attendance.service");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _Site = require("../../db/models/Site");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
var _validation = require("@ananta/validation");
var _zod = require("zod");
const attendanceRouter = exports.attendanceRouter = (0, _express.Router)();
attendanceRouter.use(_authenticate.authenticate);
attendanceRouter.post("/", (0, _rbac.requirePermission)("attendance.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = _validation.attendanceCreateSchema.parse(req.body);
  const result = await _attendance.AttendanceService.record(input, req.auth.userId, req.auth.role);
  const body = {
    success: true,
    data: result
  };
  res.status(201).json(body);
}));
attendanceRouter.post("/bulk", (0, _rbac.requirePermission)("attendance.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = _validation.attendanceBulkSchema.parse(req.body);
  const results = await _attendance.AttendanceService.bulkRecord(input, req.auth.userId, req.auth.role);
  const body = {
    success: true,
    data: results
  };
  res.status(201).json(body);
}));
attendanceRouter.patch("/correction", (0, _rbac.requirePermission)("attendance.update"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = _validation.attendanceCorrectionSchema.parse(req.body);
  const correction = await _attendance.AttendanceService.correct(input, req.auth.userId);
  const body = {
    success: true,
    data: correction
  };
  res.json(body);
}));
attendanceRouter.get("/", (0, _rbac.requirePermission)("attendance.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    site: _zod.z.string().optional(),
    worker: _zod.z.string().optional(),
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const {
    role,
    userId
  } = req.auth;
  if (role === "WORKER") {
    // A worker's attendance.read permission must never expose anyone
    // else's records — force-scope to their own profile regardless of
    // any worker/site filter the client supplied (record-level check,
    // same principle as architecture doc §4).
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: userId
    });
    if (!profile) {
      const body = {
        success: true,
        data: []
      };
      return res.json(body);
    }
    const records = await _attendance.AttendanceService.list({
      ...query,
      worker: profile._id.toString(),
      site: undefined
    });
    const body = {
      success: true,
      data: records
    };
    return res.json(body);
  }
  if (role === "MANAGER") {
    // A manager may only view attendance for sites they actually manage.
    if (query.site) {
      const site = await _Site.Site.findById(query.site);
      if (!site || site.manager?.toString() !== userId) {
        throw _AppError.AppError.forbidden("You don't manage this site.");
      }
    } else {
      const managedSites = await _Site.Site.find({
        manager: userId
      }).select("_id");
      if (managedSites.length === 0) {
        const body = {
          success: true,
          data: []
        };
        return res.json(body);
      }
      // No site filter supplied — restrict to the manager's first managed
      // site rather than silently returning company-wide records; the
      // mobile app always supplies an explicit site, so this is a safe fallback.
      query.site = managedSites[0]._id.toString();
    }
  }
  const records = await _attendance.AttendanceService.list(query);
  const body = {
    success: true,
    data: records
  };
  res.json(body);
}));