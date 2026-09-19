Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PermissionService = void 0;
var _Role = require("../../db/models/Role");
var _Permission = require("../../db/models/Permission");
var _redis = require("../../config/redis");
var _logger = require("../../config/logger");
const CACHE_TTL_SECONDS = 60; // short TTL: admin permission edits propagate within a minute
const cacheKey = roleKey => `role_permissions:${roleKey}`;
const PermissionService = exports.PermissionService = {
  /**
   * Returns the set of enabled permission keys for a role. Cached in Redis
   * because this is checked on nearly every authenticated request.
   */
  async getPermissionsForRole(roleKey) {
    try {
      const cached = await _redis.redis.get(cacheKey(roleKey));
      if (cached) return new Set(JSON.parse(cached));
    } catch (err) {
      _logger.logger.warn({
        err
      }, "Permission cache read failed, falling back to DB");
    }
    const role = await _Role.Role.findOne({
      key: roleKey
    });
    if (!role) return new Set();
    const rolePermissions = await _Permission.RolePermission.find({
      role: role._id,
      enabled: true
    }).populate("permission");
    const keys = rolePermissions.map(rp => rp.permission?.key).filter(k => Boolean(k));
    try {
      await _redis.redis.set(cacheKey(roleKey), JSON.stringify(keys), "EX", CACHE_TTL_SECONDS);
    } catch (err) {
      _logger.logger.warn({
        err
      }, "Permission cache write failed");
    }
    return new Set(keys);
  },
  async invalidateCache(roleKey) {
    await _redis.redis.del(cacheKey(roleKey));
  },
  async setRolePermission(roleKey, permissionKey, enabled, updatedBy) {
    const role = await _Role.Role.findOne({
      key: roleKey
    });
    if (!role) throw new Error(`Unknown role key: ${roleKey}`);
    const {
      Permission
    } = await import("../../db/models/Permission");
    const permission = await Permission.findOne({
      key: permissionKey
    });
    if (!permission) throw new Error(`Unknown permission key: ${permissionKey}`);
    await _Permission.RolePermission.findOneAndUpdate({
      role: role._id,
      permission: permission._id
    }, {
      enabled,
      updatedBy
    }, {
      upsert: true
    });
    await PermissionService.invalidateCache(roleKey);
  }
};