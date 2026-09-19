Object.defineProperty(exports, "__esModule", {
  value: true
});
var _auth = require("./auth.service");
var _validation = require("@ananta/validation");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
exports.AuthController = {
  registerStart: (0, _errorHandler.asyncHandler)(async (req, res) => {
    const input = _validation.registerStartSchema.parse(req.body);
    const result = await _auth.AuthService.registerStart(input);
    const body = {
      success: true,
      data: result
    };
    res.status(201).json(body);
  }),
  verifyOtp: (0, _errorHandler.asyncHandler)(async (req, res) => {
    const input = _validation.otpVerifySchema.parse(req.body);
    const result = await _auth.AuthService.verifyOtp(input);
    const body = {
      success: true,
      data: result
    };
    res.status(200).json(body);
  }),
  login: (0, _errorHandler.asyncHandler)(async (req, res) => {
    const input = _validation.loginSchema.parse(req.body);
    const result = await _auth.AuthService.login(input, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    });
    const body = {
      success: true,
      data: result
    };
    res.status(200).json(body);
  }),
  refresh: (0, _errorHandler.asyncHandler)(async (req, res) => {
    const input = _validation.refreshTokenSchema.parse(req.body);
    const result = await _auth.AuthService.refresh(input.refreshToken, input.deviceId);
    const body = {
      success: true,
      data: result
    };
    res.status(200).json(body);
  }),
  logout: (0, _errorHandler.asyncHandler)(async (req, res) => {
    if (!req.auth) throw _AppError.AppError.unauthorized();
    await _auth.AuthService.logout(req.auth.sessionId);
    const body = {
      success: true,
      data: null
    };
    res.status(200).json(body);
  }),
  logoutAll: (0, _errorHandler.asyncHandler)(async (req, res) => {
    if (!req.auth) throw _AppError.AppError.unauthorized();
    await _auth.AuthService.logoutAll(req.auth.userId);
    const body = {
      success: true,
      data: null
    };
    res.status(200).json(body);
  }),
  passwordResetRequest: (0, _errorHandler.asyncHandler)(async (req, res) => {
    const input = _validation.passwordResetRequestSchema.parse(req.body);
    const result = await _auth.AuthService.passwordResetRequest(input.phone);
    const body = {
      success: true,
      data: result
    };
    res.status(200).json(body);
  }),
  passwordReset: (0, _errorHandler.asyncHandler)(async (req, res) => {
    const input = _validation.passwordResetSchema.parse(req.body);
    await _auth.AuthService.passwordReset(input.phone, input.otp, input.newPassword);
    const body = {
      success: true,
      data: null
    };
    res.status(200).json(body);
  })
};