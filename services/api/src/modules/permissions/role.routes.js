Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rolesRouter = void 0;
var _express = require("express");
var _Role = require("../../db/models/Role");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
const rolesRouter = exports.rolesRouter = (0, _express.Router)();
rolesRouter.use(_authenticate.authenticate);
rolesRouter.get("/", (0, _rbac.requirePermission)("permission.manage"), (0, _errorHandler.asyncHandler)(async (_req, res) => {
  const roles = await _Role.Role.find().sort({
    key: 1
  });
  const data = roles.map(r => ({
    id: r._id.toString(),
    key: r.key,
    label: r.label
  }));
  const body = {
    success: true,
    data
  };
  res.json(body);
}));