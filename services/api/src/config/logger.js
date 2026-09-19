Object.defineProperty(exports, "__esModule", {
  value: true
});
var _pino = _interopRequireDefault(require("pino"));
var _env = require("./env");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// Fields that must never appear in logs, even nested. pino redact handles this
// at the transport level so a stray console-style log elsewhere can't leak them.
const REDACT_PATHS = ["req.headers.authorization", "req.body.password", "req.body.newPassword", "req.body.otp", "req.body.refreshToken", "*.passwordHash", "*.refreshTokenHash", "*.otp", "*.token"];
exports.logger = (0, _pino.default)({
  level: _env.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]"
  },
  transport: _env.env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss"
    }
  } : undefined
});