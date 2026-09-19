Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ERROR_CODES = exports.AppError = void 0;
const ERROR_CODES = exports.ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INVALID_OTP: "INVALID_OTP",
  OTP_EXPIRED: "OTP_EXPIRED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  PAYROLL_LOCKED: "PAYROLL_LOCKED",
  DUPLICATE_ATTENDANCE: "DUPLICATE_ATTENDANCE",
  PHONE_NOT_VERIFIED: "PHONE_NOT_VERIFIED",
  INTERNAL_ERROR: "INTERNAL_ERROR"
};
class AppError extends Error {
  constructor(code, message, statusCode = 400, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(ERROR_CODES.UNAUTHORIZED, message, 401);
  }
  static forbidden(message = "You don't have permission to perform this action.") {
    return new AppError(ERROR_CODES.FORBIDDEN, message, 403);
  }
  static notFound(message = "Resource not found") {
    return new AppError(ERROR_CODES.NOT_FOUND, message, 404);
  }
  static conflict(message) {
    return new AppError(ERROR_CODES.CONFLICT, message, 409);
  }
  static validation(message, details) {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 422, details);
  }
}
exports.AppError = AppError;