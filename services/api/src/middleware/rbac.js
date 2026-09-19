Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.requireAnyPermission = requireAnyPermission;
exports.requirePermission = requirePermission;
exports.requireRole = requireRole;
var _AppError = require("../errors/AppError");
var _permission = require("../modules/permissions/permission.service");
/**
 * Route-level RBAC check: "can this role perform this action at all".
 * This does NOT check record-level scope (e.g. "is this worker on a site
 * this manager manages") — that belongs in the service layer, since it
 * needs the specific record, not just the role. See architecture doc §4.
 */
function requirePermission(permissionKey) {
  return async (req, _res, next) => {
    try {
      if (!req.auth) throw _AppError.AppError.unauthorized();
      const permissions = await _permission.PermissionService.getPermissionsForRole(req.auth.role);
      req.auth.permissions = permissions;
      if (!permissions.has(permissionKey)) {
        throw _AppError.AppError.forbidden("You don't have permission to perform this action. Please contact your administrator.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Allows access if the user holds ANY of the given permission keys. */
function requireAnyPermission(...permissionKeys) {
  return async (req, _res, next) => {
    try {
      if (!req.auth) throw _AppError.AppError.unauthorized();
      const permissions = await _permission.PermissionService.getPermissionsForRole(req.auth.role);
      req.auth.permissions = permissions;
      const allowed = permissionKeys.some(k => permissions.has(k));
      if (!allowed) {
        throw _AppError.AppError.forbidden("You don't have permission to perform this action. Please contact your administrator.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
function requireRole(...roleKeys) {
  return (req, _res, next) => {
    if (!req.auth) return next(_AppError.AppError.unauthorized());
    if (!roleKeys.includes(req.auth.role)) {
      return next(_AppError.AppError.forbidden());
    }
    next();
  };
}