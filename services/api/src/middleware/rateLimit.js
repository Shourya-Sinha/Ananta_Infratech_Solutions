Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.otpRateLimit = exports.generalApiRateLimit = exports.authRateLimit = void 0;
var _expressRateLimit = _interopRequireDefault(require("express-rate-limit"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const authRateLimit = exports.authRateLimit = (0, _expressRateLimit.default)({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many attempts. Try again later."
    }
  }
});
const otpRateLimit = exports.otpRateLimit = (0, _expressRateLimit.default)({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many OTP requests. Try again later."
    }
  }
});
const generalApiRateLimit = exports.generalApiRateLimit = (0, _expressRateLimit.default)({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests."
    }
  }
});