Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rolesRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _sharedTypes = require("@ananta/shared-types");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _role = require("./role.service");
const rolesRouter = exports.rolesRouter = (0, _express.Router)();
rolesRouter.use(_authenticate.authenticate);
const actorOf = req => ({
  userId: req.auth.userId,
  baseRole: req.auth.role,
  permissions: req.auth.permissions
});
const idParam = _zod.z.object({
  id: _zod.z.string().regex(/^[a-f\d]{24}$/i, "Invalid role id")
});
const createRoleSchema = _zod.z.object({
  label: _zod.z.string().trim().min(2).max(_role.ROLE_LABEL_MAX),
  key: _zod.z.string().trim().min(3).max(40).optional(),
  description: _zod.z.string().trim().max(300).optional(),
  baseRole: _zod.z.enum(_sharedTypes.ROLE_KEYS),
  cloneFromRoleId: _zod.z.string().regex(/^[a-f\d]{24}$/i).optional()
});
const updateRoleSchema = _zod.z.object({
  label: _zod.z.string().trim().min(2).max(_role.ROLE_LABEL_MAX).optional(),
  description: _zod.z.string().trim().max(300).optional()
});
rolesRouter.get("/", (0, _rbac.requirePermission)("permission.manage"), (0, _errorHandler.asyncHandler)(async (_req, res) => {
  const data = await _role.RoleService.list();
  res.json({
    success: true,
    data
  });
}));
rolesRouter.post("/", (0, _rbac.requirePermission)("permission.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = createRoleSchema.parse(req.body);
  const data = await _role.RoleService.create(input, actorOf(req));
  res.status(201).json({
    success: true,
    data
  });
}));
rolesRouter.patch("/:id", (0, _rbac.requirePermission)("permission.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    id
  } = idParam.parse(req.params);
  const input = updateRoleSchema.parse(req.body);
  const data = await _role.RoleService.update(id, input, actorOf(req));
  res.json({
    success: true,
    data
  });
}));
rolesRouter.delete("/:id", (0, _rbac.requirePermission)("permission.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    id
  } = idParam.parse(req.params);
  const data = await _role.RoleService.remove(id, actorOf(req));
  res.json({
    success: true,
    data
  });
}));
