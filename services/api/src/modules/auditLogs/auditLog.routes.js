Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.auditLogsRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _AuditLog = require("../../db/models/AuditLog");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
const auditLogsRouter = exports.auditLogsRouter = (0, _express.Router)();
auditLogsRouter.use(_authenticate.authenticate);
auditLogsRouter.get("/", (0, _rbac.requirePermission)("auditLogs.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    actor: _zod.z.string().optional(),
    targetType: _zod.z.string().optional(),
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional(),
    page: _zod.z.coerce.number().optional(),
    pageSize: _zod.z.coerce.number().optional()
  }).parse(req.query);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
  const filter = {};
  if (query.actor) filter.actor = query.actor;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  const [items, total] = await Promise.all([_AuditLog.AuditLog.find(filter).populate("actor", "name phone").sort({
    createdAt: -1
  }).skip((page - 1) * pageSize).limit(pageSize), _AuditLog.AuditLog.countDocuments(filter)]);
  const result = {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));