Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.workTypesRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _WorkType = require("../../db/models/WorkType");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _utils = require("@ananta/utils");
const workTypesRouter = exports.workTypesRouter = (0, _express.Router)();
workTypesRouter.use(_authenticate.authenticate);
workTypesRouter.get("/", (0, _rbac.requirePermission)("worker.read"), (0, _errorHandler.asyncHandler)(async (_req, res) => {
  const workTypes = await _WorkType.WorkType.find().sort({
    name: 1
  });
  const data = workTypes.map(w => ({
    id: w._id.toString(),
    name: w.name,
    code: w.code,
    defaultDailyRate: (0, _utils.paiseToRupees)(w.defaultDailyRatePaise),
    isActive: w.isActive
  }));
  const body = {
    success: true,
    data
  };
  res.json(body);
}));
const createSchema = _zod.z.object({
  name: _zod.z.string().trim().min(2).max(80),
  code: _zod.z.string().trim().min(2).max(20),
  defaultDailyRate: _zod.z.number().positive().max(50_000) // in rupees
});
workTypesRouter.post("/", (0, _rbac.requirePermission)("worker.changeWorkType"),
// work-type config is an admin-only capability
(0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = createSchema.parse(req.body);
  const existing = await _WorkType.WorkType.findOne({
    $or: [{
      name: input.name
    }, {
      code: input.code.toUpperCase()
    }]
  });
  if (existing) throw _AppError.AppError.conflict("A work type with this name or code already exists.");
  const workType = await _WorkType.WorkType.create({
    name: input.name,
    code: input.code.toUpperCase(),
    defaultDailyRatePaise: (0, _utils.rupeesToPaise)(input.defaultDailyRate),
    createdBy: req.auth.userId
  });
  await _audit.AuditService.log({
    actor: req.auth.userId,
    action: "WORK_TYPE_CREATED",
    targetType: "WorkType",
    targetId: workType._id.toString(),
    after: input
  });
  const body = {
    success: true,
    data: workType
  };
  res.status(201).json(body);
}));
const updateSchema = _zod.z.object({
  name: _zod.z.string().trim().min(2).max(80).optional(),
  defaultDailyRate: _zod.z.number().positive().max(50_000).optional(),
  isActive: _zod.z.boolean().optional()
});
workTypesRouter.patch("/:id", (0, _rbac.requirePermission)("worker.changeWorkType"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = updateSchema.parse(req.body);
  const workType = await _WorkType.WorkType.findById(req.params.id);
  if (!workType) throw _AppError.AppError.notFound("Work type not found");
  const before = {
    name: workType.name,
    defaultDailyRatePaise: workType.defaultDailyRatePaise,
    isActive: workType.isActive
  };
  if (input.name !== undefined) workType.name = input.name;
  if (input.defaultDailyRate !== undefined) workType.defaultDailyRatePaise = (0, _utils.rupeesToPaise)(input.defaultDailyRate);
  if (input.isActive !== undefined) workType.isActive = input.isActive;
  await workType.save();
  await _audit.AuditService.log({
    actor: req.auth.userId,
    action: "WORK_TYPE_UPDATED",
    targetType: "WorkType",
    targetId: workType._id.toString(),
    before,
    after: input
  });
  const body = {
    success: true,
    data: workType
  };
  res.json(body);
}));