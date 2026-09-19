Object.defineProperty(exports, "__esModule", {
  value: true
});
var _nodeCrypto = _interopRequireDefault(require("node:crypto"));
var _redis = require("../../config/redis");
var _env = require("../../config/env");
var _AppError = require("../../errors/AppError");
var _sms = require("../notifications/sms.service");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function otpKey(phone, purpose) {
  return `otp:${purpose}:${phone}`;
}
function attemptsKey(phone, purpose) {
  return `otp_attempts:${purpose}:${phone}`;
}
function generateSixDigitOtp() {
  // crypto-secure, not Math.random
  return _nodeCrypto.default.randomInt(100000, 999999).toString();
}
exports.OtpService = {
  /**
   * Generates and stores an OTP with a TTL. In production this triggers an SMS
   * gateway send; here we return the OTP only when NODE_ENV !== 'production'
   * so local/dev testing works without a real SMS provider wired up.
   */
  async issue(phone, purpose) {
    const otp = generateSixDigitOtp();
    const hash = _nodeCrypto.default.createHash("sha256").update(otp).digest("hex");
    await _redis.redis.multi().set(otpKey(phone, purpose), hash, "EX", _env.env.OTP_TTL_SECONDS).del(attemptsKey(phone, purpose)).exec();

    // Real SMS gateway send when configured (SMS_PROVIDER=msg91 in .env);
    // otherwise this logs instead of sending, which is fine for local dev.
    await _sms.SmsService.sendOtp(phone, otp);

    // Also return the OTP directly outside production so local/dev testing
    // works without needing a real SMS provider wired up.
    return _env.env.NODE_ENV === "production" ? {} : {
      devOtp: otp
    };
  },
  async verify(phone, purpose, submittedOtp) {
    const key = otpKey(phone, purpose);
    const storedHash = await _redis.redis.get(key);
    if (!storedHash) {
      throw new _AppError.AppError(_AppError.ERROR_CODES.OTP_EXPIRED, "OTP has expired. Please request a new one.", 400);
    }
    const attempts = await _redis.redis.incr(attemptsKey(phone, purpose));
    await _redis.redis.expire(attemptsKey(phone, purpose), _env.env.OTP_TTL_SECONDS);
    if (attempts > _env.env.OTP_MAX_ATTEMPTS) {
      await _redis.redis.del(key);
      throw new _AppError.AppError(_AppError.ERROR_CODES.INVALID_OTP, "Too many incorrect attempts. Please request a new OTP.", 429);
    }
    const submittedHash = _nodeCrypto.default.createHash("sha256").update(submittedOtp).digest("hex");
    const valid = submittedHash.length === storedHash.length && _nodeCrypto.default.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(storedHash));
    if (!valid) {
      throw new _AppError.AppError(_AppError.ERROR_CODES.INVALID_OTP, "Incorrect OTP.", 400);
    }
    await _redis.redis.del(key);
    await _redis.redis.del(attemptsKey(phone, purpose));
  }
};