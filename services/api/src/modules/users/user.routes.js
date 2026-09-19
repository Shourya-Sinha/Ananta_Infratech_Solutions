Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.usersRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _user = require("./user.service");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _validation = require("@ananta/validation");
var _sharedTypes = require("@ananta/shared-types");
var _gateway = require("../../sockets/gateway");
const usersRouter = exports.usersRouter = (0, _express.Router)();
usersRouter.use(_authenticate.authenticate);
usersRouter.get("/", (0, _rbac.requirePermission)("user.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    role: _zod.z.enum(_sharedTypes.ROLE_KEYS).optional(),
    status: _zod.z.enum(_sharedTypes.USER_STATUS).optional(),
    search: _zod.z.string().optional(),
    page: _zod.z.coerce.number().optional(),
    pageSize: _zod.z.coerce.number().optional()
  }).parse(req.query);
  const result = await _user.UserService.list(query);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));
usersRouter.get("/:id", (0, _rbac.requirePermission)("user.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const user = await _user.UserService.getById(req.params.id);
  const body = {
    success: true,
    data: user
  };
  res.json(body);
}));
const createUserSchema = _zod.z.object({
  name: _zod.z.string().trim().min(2).max(120),
  phone: _validation.phoneSchema,
  email: _zod.z.string().trim().email().optional(),
  roleKey: _zod.z.enum(_sharedTypes.ROLE_KEYS)
});
usersRouter.post("/", (0, _rbac.requirePermission)("user.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = createUserSchema.parse(req.body);
  const result = await _user.UserService.create(input, req.auth.userId);
  (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.USER_CREATED, {
    userId: result.user._id.toString()
  });
  const body = {
    success: true,
    data: result
  };
  res.status(201).json(body);
}));
const updateUserSchema = _zod.z.object({
  name: _zod.z.string().trim().min(2).max(120).optional(),
  email: _zod.z.string().trim().email().optional()
});
usersRouter.patch("/:id", (0, _rbac.requirePermission)("user.update"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = updateUserSchema.parse(req.body);
  const user = await _user.UserService.update(req.params.id, input, req.auth.userId);
  (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.USER_UPDATED, {
    userId: user._id.toString()
  });
  (0, _gateway.getIO)().to(_sharedTypes.ROOMS.user(user._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.USER_UPDATED, {
    userId: user._id.toString()
  });
  const body = {
    success: true,
    data: user
  };
  res.json(body);
}));
const setStatusSchema = _zod.z.object({
  status: _zod.z.enum(["ACTIVE", "SUSPENDED"])
});
usersRouter.post("/:id/status", (0, _rbac.requirePermission)("user.update"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    status
  } = setStatusSchema.parse(req.body);
  const user = await _user.UserService.setStatus(req.params.id, status, req.auth.userId);
  (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.user(user._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.USER_STATUS_CHANGED, {
    userId: user._id.toString(),
    status
  });
  const body = {
    success: true,
    data: user
  };
  res.json(body);
}));
usersRouter.delete("/:id", (0, _rbac.requirePermission)("user.delete"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const result = await _user.UserService.delete(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));