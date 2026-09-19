Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.notificationsRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _notification = require("./notification.service");
var _push = require("./push.service");
var _authenticate = require("../../middleware/authenticate");
var _errorHandler = require("../../middleware/errorHandler");
const notificationsRouter = exports.notificationsRouter = (0, _express.Router)();
notificationsRouter.use(_authenticate.authenticate);
notificationsRouter.get("/", (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    page: _zod.z.coerce.number().optional(),
    pageSize: _zod.z.coerce.number().optional()
  }).parse(req.query);
  const result = await _notification.NotificationService.listForUser(req.auth.userId, query.page, query.pageSize);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));
notificationsRouter.post("/:id/read", (0, _errorHandler.asyncHandler)(async (req, res) => {
  const notification = await _notification.NotificationService.markRead(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: notification
  };
  res.json(body);
}));
const registerPushTokenSchema = _zod.z.object({
  deviceId: _zod.z.string().min(1),
  fcmToken: _zod.z.string().min(1)
});
notificationsRouter.post("/push-token", (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    deviceId,
    fcmToken
  } = registerPushTokenSchema.parse(req.body);
  await _push.PushNotificationService.registerToken(req.auth.userId, deviceId, fcmToken);
  const body = {
    success: true,
    data: null
  };
  res.status(201).json(body);
}));
notificationsRouter.delete("/push-token/:deviceId", (0, _errorHandler.asyncHandler)(async (req, res) => {
  await _push.PushNotificationService.unregisterToken(req.auth.userId, req.params.deviceId);
  const body = {
    success: true,
    data: null
  };
  res.json(body);
}));