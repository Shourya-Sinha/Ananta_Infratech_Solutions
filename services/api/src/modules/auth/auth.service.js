Object.defineProperty(exports, "__esModule", {
  value: true
});
var _argon = _interopRequireDefault(require("argon2"));
var _nodeCrypto = _interopRequireDefault(require("node:crypto"));
var _mongoose = require("mongoose");
var _User = require("../../db/models/User");
var _Role = require("../../db/models/Role");
var _Session = require("../../db/models/Session");
var _otp = require("./otp.service");
var _token = require("./token.service");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function hashToken(token) {
  return _nodeCrypto.default.createHash("sha256").update(token).digest("hex");
}
exports.AuthService = {
  /**
   * Step 1 of worker registration (§7 in spec). Creates the User in
   * PENDING_VERIFICATION and sends an OTP to confirm the phone number.
   * WorkerProfile creation (work type, documents) happens in later steps
   * handled by the workers module, not here.
   */
  async registerStart(input) {
    const existing = await _User.User.findOne({
      phone: input.phone
    });

    if (existing) {
      if (existing.phoneVerified) {
        throw _AppError.AppError.conflict("An account with this phone number already exists.");
      }
      // Existing but never completed OTP verification — treat this as a
      // clean restart rather than a hard block: update their name/password
      // (in case they mistyped either the first time) and resend a fresh
      // OTP. Nothing sensitive is exposed by this since the account holds
      // no verified data yet.
      existing.name = input.fullName;
      existing.passwordHash = await _argon.default.hash(input.password);
      if (input.email) existing.email = input.email;
      await existing.save();

      const {
        devOtp
      } = await _otp.OtpService.issue(input.phone, "REGISTRATION");
      await _audit.AuditService.log({
        actor: existing._id.toString(),
        action: "USER_REGISTRATION_RESTARTED",
        targetType: "User",
        targetId: existing._id.toString()
      });
      return {
        userId: existing._id.toString(),
        devOtp
      };
    }

    const workerRole = await _Role.Role.findOne({
      key: "WORKER"
    });
    if (!workerRole) throw new _AppError.AppError(_AppError.ERROR_CODES.INTERNAL_ERROR, "WORKER role not seeded", 500);

    // Worker sets their real password up front at registration — no more
    // placeholder + forced password-reset detour. They still can't log in
    // until they verify the OTP sent below, since the account starts in
    // PENDING_VERIFICATION and login only checks status !== SUSPENDED, so
    // verifying phone ownership is enforced by the OTP step, not by
    // blocking login outright.
    const passwordHash = await _argon.default.hash(input.password);
    const user = await _User.User.create({
      role: workerRole._id,
      name: input.fullName,
      phone: input.phone,
      email: input.email,
      passwordHash,
      status: "PENDING_VERIFICATION"
    });
    const {
      devOtp
    } = await _otp.OtpService.issue(input.phone, "REGISTRATION");
    await _audit.AuditService.log({
      actor: user._id.toString(),
      action: "USER_REGISTRATION_STARTED",
      targetType: "User",
      targetId: user._id.toString()
    });
    return {
      userId: user._id.toString(),
      devOtp
    };
  },
  async verifyOtp(input) {
    await _otp.OtpService.verify(input.phone, input.purpose, input.otp);
    if (input.purpose === "REGISTRATION") {
      // Phone confirmed; profile stays PENDING_VERIFICATION until documents +
      // work type are verified by Admin (handled in workers module). The
      // phoneVerified flag is what actually gates login (see login()) —
      // without this, someone could register with a phone they don't own
      // and set a password without ever proving they control that number.
      const user = await _User.User.findOne({
        phone: input.phone
      });
      if (!user) throw _AppError.AppError.notFound("Account not found");
      user.phoneVerified = true;
      await user.save();
      return {
        userId: user._id.toString(),
        phoneVerified: true
      };
    }
    return {
      phoneVerified: true
    };
  },
  async login(input, meta) {
    const user = await _User.User.findOne({
      phone: input.phone
    }).select("+passwordHash").populate("role");
    if (!user) throw _AppError.AppError.unauthorized("Invalid phone number or password.");
    if (user.status === "SUSPENDED") {
      throw _AppError.AppError.forbidden("This account has been suspended. Contact your administrator.");
    }
    const passwordValid = await _argon.default.verify(user.passwordHash, input.password);
    if (!passwordValid) throw _AppError.AppError.unauthorized("Invalid phone number or password.");
    if (!user.phoneVerified) {
      // Checked after password validation (not before) so a wrong-password
      // attempt doesn't leak whether phone verification is still pending.
      throw new _AppError.AppError(_AppError.ERROR_CODES.PHONE_NOT_VERIFIED, "Please verify your phone number with the OTP sent during registration before logging in.", 403);
    }
    const sessionId = new _mongoose.Types.ObjectId();
    const refreshToken = _token.TokenService.signRefreshToken({
      sub: user._id.toString(),
      sessionId: sessionId.toString()
    });
    const now = new Date();
    await _Session.Session.create({
      _id: sessionId,
      user: user._id,
      deviceId: input.deviceId,
      refreshTokenHash: hashToken(refreshToken),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      lastActivityAt: now,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
    const roleKey = user.role.key;
    const accessToken = _token.TokenService.signAccessToken({
      sub: user._id.toString(),
      role: roleKey,
      sessionId: sessionId.toString()
    });
    user.lastLoginAt = now;
    await user.save();
    await _audit.AuditService.log({
      actor: user._id.toString(),
      action: "USER_LOGIN",
      targetType: "User",
      targetId: user._id.toString(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        role: roleKey
      }
    };
  },
  async refresh(refreshToken, deviceId) {
    let payload;
    try {
      payload = _token.TokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new _AppError.AppError(_AppError.ERROR_CODES.TOKEN_INVALID, "Invalid or expired refresh token.", 401);
    }
    const session = await _Session.Session.findById(payload.sessionId).select("+refreshTokenHash");
    if (!session || session.revoked || session.deviceId !== deviceId) {
      throw new _AppError.AppError(_AppError.ERROR_CODES.TOKEN_INVALID, "Session not recognized. Please log in again.", 401);
    }
    if (session.expiresAt < new Date()) {
      throw new _AppError.AppError(_AppError.ERROR_CODES.TOKEN_EXPIRED, "Session expired. Please log in again.", 401);
    }
    if (hashToken(refreshToken) !== session.refreshTokenHash) {
      // Refresh token reuse detection: revoke the session outright.
      session.revoked = true;
      session.revokedAt = new Date();
      await session.save();
      throw new _AppError.AppError(_AppError.ERROR_CODES.TOKEN_INVALID, "Session invalidated. Please log in again.", 401);
    }
    const user = await _User.User.findById(payload.sub).populate("role");
    if (!user) throw _AppError.AppError.unauthorized();

    // Rotate: issue a new refresh token and invalidate the old one.
    const newRefreshToken = _token.TokenService.signRefreshToken({
      sub: user._id.toString(),
      sessionId: session._id.toString()
    });
    session.refreshTokenHash = hashToken(newRefreshToken);
    session.lastActivityAt = new Date();
    await session.save();
    const roleKey = user.role.key;
    const accessToken = _token.TokenService.signAccessToken({
      sub: user._id.toString(),
      role: roleKey,
      sessionId: session._id.toString()
    });
    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  },
  async logout(sessionId) {
    await _Session.Session.findByIdAndUpdate(sessionId, {
      revoked: true,
      revokedAt: new Date()
    });
  },
  async logoutAll(userId) {
    await _Session.Session.updateMany({
      user: userId,
      revoked: false
    }, {
      revoked: true,
      revokedAt: new Date()
    });
  },
  async passwordResetRequest(phone) {
    const user = await _User.User.findOne({
      phone
    });
    if (!user) return {}; // don't reveal account existence
    const {
      devOtp
    } = await _otp.OtpService.issue(phone, "PASSWORD_RESET");
    return {
      devOtp
    };
  },
  async passwordReset(phone, otp, newPassword) {
    await _otp.OtpService.verify(phone, "PASSWORD_RESET", otp);
    const user = await _User.User.findOne({
      phone
    });
    if (!user) throw _AppError.AppError.notFound("Account not found");
    user.passwordHash = await _argon.default.hash(newPassword);
    await user.save();

    // Any password reset invalidates all existing sessions for safety.
    await _Session.Session.updateMany({
      user: user._id,
      revoked: false
    }, {
      revoked: true,
      revokedAt: new Date()
    });
    await _audit.AuditService.log({
      actor: user._id.toString(),
      action: "USER_PASSWORD_RESET",
      targetType: "User",
      targetId: user._id.toString()
    });
  }
};