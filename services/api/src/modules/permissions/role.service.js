Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RoleService = exports.ROLE_LABEL_MAX = void 0;
var _Role = require("../../db/models/Role");
var _Permission = require("../../db/models/Permission");
var _User = require("../../db/models/User");
var _Session = require("../../db/models/Session");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _permission = require("./permission.service");
const ROLE_LABEL_MAX = exports.ROLE_LABEL_MAX = 60;

/** "Site Supervisor" -> "SITE_SUPERVISOR" */
function deriveKey(label) {
  return label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}
function toDto(role, userCount = 0) {
  return {
    id: role._id.toString(),
    key: role.key,
    label: role.label,
    description: role.description ?? "",
    baseRole: role.baseRole ?? role.key,
    isSystemRole: Boolean(role.isSystemRole),
    userCount
  };
}

/**
 * You cannot hand out permissions you do not hold yourself. Super Admin is
 * exempt. `actor.permissions` is the caller's resolved permission set.
 */
function assertCanGrantAll(actor, permissionKeys) {
  if (actor.baseRole === "SUPER_ADMIN") return;
  const held = actor.permissions ?? new Set();
  const missing = [...permissionKeys].filter(k => !held.has(k));
  if (missing.length) {
    throw _AppError.AppError.forbidden(`You cannot grant permissions you do not have: ${missing.join(", ")}`);
  }
}

/**
 * Privilege-escalation guard: only a Super Admin may create, grant, or
 * manage roles whose base is SUPER_ADMIN. Everyone else can only delegate
 * up to MANAGER / WORKER scope.
 */
function assertActorCanUseBase(actorBase, baseRole) {
  if (baseRole === "SUPER_ADMIN" && actorBase !== "SUPER_ADMIN") {
    throw _AppError.AppError.forbidden("Only a Super Admin can grant Super Admin-level roles.");
  }
}
const RoleService = exports.RoleService = {
  deriveKey,
  assertActorCanUseBase,
  assertCanGrantAll,
  async list() {
    const roles = await _Role.Role.find().sort({
      isSystemRole: -1,
      label: 1
    });
    const counts = await _User.User.aggregate([{
      $group: {
        _id: "$role",
        count: {
          $sum: 1
        }
      }
    }]);
    const countMap = new Map(counts.map(c => [c._id.toString(), c.count]));
    return roles.map(r => toDto(r, countMap.get(r._id.toString()) ?? 0));
  },
  async create(input, actor) {
    assertActorCanUseBase(actor.baseRole, input.baseRole);
    const key = (input.key ?? deriveKey(input.label)).toUpperCase();
    if (!_Role.ROLE_KEY_PATTERN.test(key)) {
      throw _AppError.AppError.validation("Role key must be 3-40 characters: A-Z, 0-9 and underscore, starting with a letter.");
    }
    if (await _Role.Role.exists({
      key
    })) {
      throw _AppError.AppError.conflict(`A role with key ${key} already exists.`);
    }
    let source = null;
    if (input.cloneFromRoleId) {
      source = await _Role.Role.findById(input.cloneFromRoleId);
      if (!source) throw _AppError.AppError.validation("The role to copy permissions from does not exist.");
      // You can only copy a role you could already assign.
      assertActorCanUseBase(actor.baseRole, source.baseRole);
    }
    const role = await _Role.Role.create({
      key,
      label: input.label,
      description: input.description ?? "",
      baseRole: input.baseRole,
      isSystemRole: false
    });
    if (source) {
      const grants = await _Permission.RolePermission.find({
        role: source._id,
        enabled: true
      }).populate("permission");
      assertCanGrantAll(actor, grants.map(g => g.permission?.key).filter(Boolean));
      if (grants.length) {
        await _Permission.RolePermission.insertMany(grants.map(g => ({
          role: role._id,
          permission: g.permission,
          enabled: true,
          updatedBy: actor.userId
        })));
      }
    }
    await _audit.AuditService.log({
      actor: actor.userId,
      action: "ROLE_CREATED",
      targetType: "Role",
      targetId: role._id.toString(),
      after: {
        key,
        label: role.label,
        baseRole: role.baseRole,
        clonedFrom: source?.key ?? null
      }
    });
    return toDto(role, 0);
  },
  async update(roleId, input, actor) {
    const role = await _Role.Role.findById(roleId);
    if (!role) throw _AppError.AppError.notFound("Role not found");
    if (role.key === "SUPER_ADMIN" && actor.baseRole !== "SUPER_ADMIN") {
      throw _AppError.AppError.forbidden();
    }
    const before = {
      label: role.label,
      description: role.description
    };
    if (input.label !== undefined) role.label = input.label;
    if (input.description !== undefined) role.description = input.description;
    await role.save();
    await _audit.AuditService.log({
      actor: actor.userId,
      action: "ROLE_UPDATED",
      targetType: "Role",
      targetId: role._id.toString(),
      before,
      after: input
    });
    const userCount = await _User.User.countDocuments({
      role: role._id
    });
    return toDto(role, userCount);
  },
  async remove(roleId, actor) {
    const role = await _Role.Role.findById(roleId);
    if (!role) throw _AppError.AppError.notFound("Role not found");
    if (role.isSystemRole) throw _AppError.AppError.conflict("Built-in roles cannot be deleted.");
    const userCount = await _User.User.countDocuments({
      role: role._id
    });
    if (userCount > 0) {
      throw _AppError.AppError.conflict(`${userCount} user(s) still have this role. Reassign them before deleting it.`);
    }
    await _Permission.RolePermission.deleteMany({
      role: role._id
    });
    await _Role.Role.deleteOne({
      _id: role._id
    });
    await _permission.PermissionService.invalidateCache(role.key);
    await _audit.AuditService.log({
      actor: actor.userId,
      action: "ROLE_DELETED",
      targetType: "Role",
      targetId: role._id.toString(),
      before: {
        key: role.key,
        label: role.label,
        baseRole: role.baseRole
      }
    });
    return {
      deleted: true
    };
  },
  /**
   * Assigns a role to a user. Revokes the user's live sessions so the new
   * permissions apply on their next sign-in (or refresh) rather than after
   * the access token expires.
   */
  async assignToUser(userId, roleKey, actor) {
    const user = await _User.User.findById(userId).populate("role");
    if (!user) throw _AppError.AppError.notFound("User not found");
    const role = await _Role.Role.findOne({
      key: roleKey.toUpperCase()
    });
    if (!role) throw _AppError.AppError.validation(`Unknown role: ${roleKey}`);
    assertActorCanUseBase(actor.baseRole, role.baseRole);
    const targetPermissions = await _permission.PermissionService.getPermissionsForRole(role.key);
    assertCanGrantAll(actor, targetPermissions);
    if (user.role?.key === "SUPER_ADMIN" && role.key !== "SUPER_ADMIN" && actor.baseRole === "SUPER_ADMIN") {
      const superAdmins = await _User.User.countDocuments({
        role: user.role._id
      });
      if (superAdmins <= 1) throw _AppError.AppError.conflict("You cannot demote the last Super Admin.");
    }
    if (user.role?._id?.toString() === role._id.toString()) return user;
    const before = {
      role: user.role?.key
    };
    user.role = role._id;
    await user.save();
    await _Session.Session.updateMany({
      user: user._id,
      revoked: false
    }, {
      revoked: true
    });
    await _audit.AuditService.log({
      actor: actor.userId,
      action: "USER_ROLE_CHANGED",
      targetType: "User",
      targetId: user._id.toString(),
      before,
      after: {
        role: role.key
      }
    });
    return user;
  }
};
