Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.authRouter = void 0;
var _express = require("express");
var _auth = require("./auth.controller");
var _authenticate = require("../../middleware/authenticate");
var _rateLimit = require("../../middleware/rateLimit");
const authRouter = exports.authRouter = (0, _express.Router)();

/**
 * @openapi
 * /auth/register/start:
 *   post:
 *     summary: Step 1 of worker registration — create account, send OTP
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone, address]
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string, example: "9876543210" }
 *               email: { type: string }
 *               address: { type: string }
 *     responses:
 *       201: { description: Account created, OTP sent }
 *       409: { description: Phone number already registered }
 */
authRouter.post("/register/start", _rateLimit.otpRateLimit, _auth.AuthController.registerStart);

/**
 * @openapi
 * /auth/otp/verify:
 *   post:
 *     summary: Verify an OTP for registration, login, or password reset
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, otp, purpose]
 *             properties:
 *               phone: { type: string }
 *               otp: { type: string, example: "123456" }
 *               purpose: { type: string, enum: [REGISTRATION, LOGIN, PASSWORD_RESET] }
 *     responses:
 *       200: { description: OTP verified }
 *       400: { description: Invalid or expired OTP }
 */
authRouter.post("/otp/verify", _rateLimit.otpRateLimit, _auth.AuthController.verifyOtp);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with phone + password, returns access/refresh tokens
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password, deviceId]
 *             properties:
 *               phone: { type: string }
 *               password: { type: string }
 *               deviceId: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 *       403: { description: Account suspended }
 */
authRouter.post("/login", _rateLimit.authRateLimit, _auth.AuthController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new access/refresh token pair (rotation)
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200: { description: New token pair issued }
 *       401: { description: Refresh token invalid, expired, or reused }
 */
authRouter.post("/refresh", _rateLimit.authRateLimit, _auth.AuthController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current session
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out }
 */
authRouter.post("/logout", _authenticate.authenticate, _auth.AuthController.logout);

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     summary: Revoke every session/device for the current user
 *     tags: [Auth]
 *     responses:
 *       200: { description: All sessions revoked }
 */
authRouter.post("/logout-all", _authenticate.authenticate, _auth.AuthController.logoutAll);
authRouter.post("/password/reset-request", _rateLimit.otpRateLimit, _auth.AuthController.passwordResetRequest);
authRouter.post("/password/reset", _rateLimit.authRateLimit, _auth.AuthController.passwordReset);