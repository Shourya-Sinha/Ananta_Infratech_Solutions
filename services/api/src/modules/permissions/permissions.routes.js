Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.permissionsRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _Permission = require("../../db/models/Permission");
var _Role = require("../../db/models/Role");
var _permission = require("./permission.service");
var _audit = require("../auditLogs/audit.service");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
const permissionsRouter = exports.permissionsRouter = (0, _express.Router)();
permissionsRouter.use(_authenticate.authenticate);

// GET /permissions — full permission catalog, grouped
permissionsRouter.get("/", (0, _rbac.requirePermission)("permission.manage"), (0, _errorHandler.asyncHandler)(async (_req, res) => {
  const permissions = await _Permission.Permission.find().sort({
    group: 1,
    key: 1
  });
  const body = {
    success: true,
    data: permissions
  };
  res.json(body);
}));

// GET /permissions/role/:roleId — the matrix for one role
permissionsRouter.get("/role/:roleId", (0, _rbac.requirePermission)("permission.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const role = await _Role.Role.findById(req.params.roleId);
  if (!role) throw _AppError.AppError.notFound("Role not found");
  const allPermissions = await _Permission.Permission.find().sort({
    group: 1,
    key: 1
  });
  const rolePermissions = await _Permission.RolePermission.find({
    role: role._id
  });
  const enabledMap = new Map(rolePermissions.map(rp => [rp.permission.toString(), rp.enabled]));
  const matrix = allPermissions.map(p => ({
    permissionId: p._id.toString(),
    key: p.key,
    group: p.group,
    description: p.description,
    enabled: enabledMap.get(p._id.toString()) ?? false
  }));
  const body = {
    success: true,
    data: matrix
  };
  res.json(body);
}));
const updateRolePermissionsSchema = _zod.z.object({
  updates: _zod.z.array(_zod.z.object({
    permissionKey: _zod.z.string().min(1),
    enabled: _zod.z.boolean()
  })).min(1).max(200)
});

// PATCH /permissions/role/:roleId — bulk toggle
permissionsRouter.patch("/role/:roleId", (0, _rbac.requirePermission)("permission.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const role = await _Role.Role.findById(req.params.roleId);
  if (!role) throw _AppError.AppError.notFound("Role not found");
  if (role.isSystemRole && role.key === "SUPER_ADMIN") {
    throw _AppError.AppError.forbidden("SUPER_ADMIN permissions cannot be restricted.");
  }
  const {
    updates
  } = updateRolePermissionsSchema.parse(req.body);
  const actorId = req.auth.userId;
  for (const u of updates) {
    await _permission.PermissionService.setRolePermission(role.key, u.permissionKey, u.enabled, actorId);
  }
  await _audit.AuditService.log({
    actor: actorId,
    action: "ROLE_PERMISSIONS_UPDATED",
    targetType: "Role",
    targetId: role._id.toString(),
    after: updates
  });
  const body = {
    success: true,
    data: {
      updated: updates.length
    }
  };
  res.json(body);
}));