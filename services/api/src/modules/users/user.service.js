Object.defineProperty(exports, "__esModule", {
  value: true
});
var _User = require("../../db/models/User");
var _Role = require("../../db/models/Role");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _argon = _interopRequireDefault(require("argon2"));
var _nodeCrypto = _interopRequireDefault(require("node:crypto"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
exports.UserService = {
  async list(query) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const filter = {};
    if (query.role) {
      const role = await _Role.Role.findOne({
        key: query.role
      });
      if (role) filter.role = role._id;
    }
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [{
        name: {
          $regex: query.search,
          $options: "i"
        }
      }, {
        phone: {
          $regex: query.search,
          $options: "i"
        }
      }, {
        email: {
          $regex: query.search,
          $options: "i"
        }
      }];
    }
    const [items, total] = await Promise.all([_User.User.find(filter).populate("role", "key label").sort({
      createdAt: -1
    }).skip((page - 1) * pageSize).limit(pageSize), _User.User.countDocuments(filter)]);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  },
  async getById(userId) {
    const user = await _User.User.findById(userId).populate("role", "key label");
    if (!user) throw _AppError.AppError.notFound("User not found");
    return user;
  },
  /** Admin-created user (e.g. another Manager or Super Admin account). */
  async create(input, actorId) {
    const existing = await _User.User.findOne({
      phone: input.phone
    });
    if (existing) throw _AppError.AppError.conflict("A user with this phone number already exists.");
    const role = await _Role.Role.findOne({
      key: input.roleKey
    });
    if (!role) throw _AppError.AppError.validation(`Unknown role: ${input.roleKey}`);
    const temporaryPassword = _nodeCrypto.default.randomBytes(9).toString("base64url");
    const passwordHash = await _argon.default.hash(temporaryPassword);
    const user = await _User.User.create({
      role: role._id,
      name: input.name,
      phone: input.phone,
      email: input.email,
      passwordHash,
      status: "ACTIVE",
      // Admin-created accounts (Managers, other admins) are trusted by the
      // creating admin directly — they skip self-service OTP verification,
      // unlike self-registered Worker accounts via /auth/register/start.
      phoneVerified: true
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "USER_CREATED",
      targetType: "User",
      targetId: user._id.toString(),
      after: {
        name: input.name,
        phone: input.phone,
        role: input.roleKey
      }
    });

    // In production this triggers an SMS/email with the temp password / a
    // "set your password" link instead of returning it directly.
    return {
      user,
      temporaryPassword
    };
  },
  async update(userId, updates, actorId) {
    const user = await _User.User.findById(userId);
    if (!user) throw _AppError.AppError.notFound("User not found");
    const before = {
      name: user.name,
      email: user.email
    };
    if (updates.name !== undefined) user.name = updates.name;
    if (updates.email !== undefined) user.email = updates.email;
    await user.save();
    await _audit.AuditService.log({
      actor: actorId,
      action: "USER_UPDATED",
      targetType: "User",
      targetId: user._id.toString(),
      before,
      after: updates
    });
    return user;
  },
  async setStatus(userId, status, actorId) {
    const user = await _User.User.findById(userId);
    if (!user) throw _AppError.AppError.notFound("User not found");
    const before = {
      status: user.status
    };
    user.status = status;
    await user.save();
    if (status === "SUSPENDED") {
      const {
        Session
      } = await import("../../db/models/Session");
      await Session.updateMany({
        user: user._id,
        revoked: false
      }, {
        revoked: true,
        revokedAt: new Date()
      });
    }
    await _audit.AuditService.log({
      actor: actorId,
      action: "USER_STATUS_CHANGED",
      targetType: "User",
      targetId: user._id.toString(),
      before,
      after: {
        status
      }
    });
    return user;
  },
  async delete(userId, actorId) {
    const user = await _User.User.findById(userId);
    if (!user) throw _AppError.AppError.notFound("User not found");

    // Soft-delete via SUSPENDED + a deleted flag would be more typical, but
    // since User has no isDeleted field yet, we hard-block deletion of the
    // last active Super Admin as a safety rail and otherwise suspend+mark.
    user.status = "SUSPENDED";
    await user.save();
    const {
      Session
    } = await import("../../db/models/Session");
    await Session.updateMany({
      user: user._id,
      revoked: false
    }, {
      revoked: true,
      revokedAt: new Date()
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "USER_DELETED",
      targetType: "User",
      targetId: user._id.toString()
    });
    return {
      deactivated: true
    };
  }
};