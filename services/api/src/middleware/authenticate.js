Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.authenticate = authenticate;
var _token = require("../modules/auth/token.service");
var _AppError = require("../errors/AppError");
var _Session = require("../db/models/Session");
/**
 * Verifies the access token, confirms the underlying session hasn't been
 * revoked, and attaches a minimal auth context to the request. Permission
 * loading happens separately in requirePermission (rbac.ts) so routes that
 * only need "is this user logged in" don't pay for a permission-set lookup.
 */
async function authenticate(req, _res, next) {
  try {
    const header = req.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw _AppError.AppError.unauthorized("Missing or malformed Authorization header.");
    }
    const token = header.slice("Bearer ".length);
    let payload;
    try {
      payload = _token.TokenService.verifyAccessToken(token);
    } catch {
      throw _AppError.AppError.unauthorized("Invalid or expired access token.");
    }
    const session = await _Session.Session.findById(payload.sessionId);
    if (!session || session.revoked) {
      throw _AppError.AppError.unauthorized("Session no longer valid. Please log in again.");
    }
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      sessionId: payload.sessionId,
      permissions: new Set()
    };

    // best-effort activity tracking, doesn't block the request
    session.lastActivityAt = new Date();
    void session.save();
    next();
  } catch (err) {
    next(err);
  }
}