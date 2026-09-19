Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.registerStartSchema = exports.refreshTokenSchema = exports.phoneSchema = exports.passwordSchema = exports.passwordResetSchema = exports.passwordResetRequestSchema = exports.otpVerifySchema = exports.otpSchema = exports.loginSchema = void 0;
var _zod = require("zod");
// Indian mobile number: 10 digits, optionally prefixed with +91
const phoneSchema = exports.phoneSchema = _zod.z.string().trim().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid Indian mobile number");
const otpSchema = exports.otpSchema = _zod.z.string().regex(/^\d{6}$/, "OTP must be 6 digits");
const passwordSchema = exports.passwordSchema = _zod.z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain an uppercase letter").regex(/[a-z]/, "Password must contain a lowercase letter").regex(/\d/, "Password must contain a number");
const registerStartSchema = exports.registerStartSchema = _zod.z.object({
  fullName: _zod.z.string().trim().min(2).max(120),
  phone: phoneSchema,
  password: passwordSchema,
  email: _zod.z.string().trim().email().optional(),
  address: _zod.z.string().trim().min(5).max(300),
  dateOfBirth: _zod.z.string().datetime().optional(),
  gender: _zod.z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  emergencyContactName: _zod.z.string().trim().min(2).max(120).optional(),
  emergencyContactPhone: phoneSchema.optional()
});
const otpVerifySchema = exports.otpVerifySchema = _zod.z.object({
  phone: phoneSchema,
  otp: otpSchema,
  purpose: _zod.z.enum(["REGISTRATION", "LOGIN", "PASSWORD_RESET"])
});
const loginSchema = exports.loginSchema = _zod.z.object({
  phone: phoneSchema,
  password: passwordSchema,
  deviceId: _zod.z.string().min(1)
});
const refreshTokenSchema = exports.refreshTokenSchema = _zod.z.object({
  refreshToken: _zod.z.string().min(10),
  deviceId: _zod.z.string().min(1)
});
const passwordResetRequestSchema = exports.passwordResetRequestSchema = _zod.z.object({
  phone: phoneSchema
});
const passwordResetSchema = exports.passwordResetSchema = _zod.z.object({
  phone: phoneSchema,
  otp: otpSchema,
  newPassword: passwordSchema
});