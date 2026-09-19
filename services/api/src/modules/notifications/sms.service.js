Object.defineProperty(exports, "__esModule", {
  value: true
});
var _logger = require("../../config/logger");
var _env = require("../../config/env");
/**
 * MSG91 is a common SMS gateway for Indian phone numbers (relevant since
 * this system targets an Indian construction company). Any REST-based
 * provider can be swapped in by implementing SmsProvider — this class is
 * the only place that needs to change.
 */
class Msg91Provider {
  async send(phone, message) {
    const normalizedPhone = phone.replace(/^\+?91/, "");
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: _env.env.SMS_API_KEY
      },
      body: JSON.stringify({
        flow_id: _env.env.SMS_TEMPLATE_ID,
        sender: _env.env.SMS_SENDER_ID,
        mobiles: `91${normalizedPhone}`,
        VAR1: message
      })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`SMS provider responded ${response.status}: ${text}`);
    }
  }
}

/** Used when no SMS provider is configured — logs instead of sending, never throws. */
class NoopProvider {
  async send(phone, message) {
    _logger.logger.info({
      phone,
      message
    }, "[SMS noop] No SMS_PROVIDER configured — message logged, not sent");
  }
}
function getProvider() {
  if (_env.env.SMS_PROVIDER === "msg91" && _env.env.SMS_API_KEY) return new Msg91Provider();
  return new NoopProvider();
}
exports.SmsService = {
  /**
   * Sends an OTP SMS. Never throws to the caller on delivery failure —
   * OTP flows already have a dev-mode fallback (returning the OTP directly
   * outside production, see OtpService), so a transient SMS gateway failure
   * shouldn't 500 the registration/login endpoint. The failure is logged
   * for ops to investigate.
   */
  async sendOtp(phone, otp) {
    const message = `Your Ananta Infratech verification code is ${otp}. Valid for ${_env.env.OTP_TTL_SECONDS / 60} minutes. Do not share this code.`;
    try {
      await getProvider().send(phone, message);
    } catch (err) {
      _logger.logger.error({
        err,
        phone
      }, "Failed to send OTP SMS");
    }
  }
};