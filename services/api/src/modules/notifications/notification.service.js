Object.defineProperty(exports, "__esModule", {
  value: true
});
var _Notification = require("../../db/models/Notification");
var _gateway = require("../../sockets/gateway");
var _sharedTypes = require("@ananta/shared-types");
var _logger = require("../../config/logger");
var _push = require("./push.service");
exports.NotificationService = {
  async send(input) {
    const notification = await _Notification.Notification.create({
      recipient: input.recipient,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data
    });
    try {
      (0, _gateway.getIO)().to(_sharedTypes.ROOMS.user(input.recipient)).emit(_sharedTypes.SOCKET_EVENTS.NOTIFICATION_NEW, {
        id: notification._id.toString(),
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
        createdAt: notification.createdAt
      });
    } catch (err) {
      // Socket gateway may not be initialized in test/script contexts —
      // notification is still persisted and readable via the API.
      _logger.logger.debug({
        err
      }, "Skipped realtime emit for notification");
    }

    // Real Expo push dispatch to every registered device for this user.
    // Fire-and-forget from the caller's perspective — dispatch() never throws.
    void _push.PushNotificationService.dispatch(input.recipient, {
      title: input.title,
      body: input.body,
      data: {
        notificationId: notification._id.toString(),
        type: input.type,
        ...input.data
      }
    });
    return notification;
  },
  async listForUser(userId, page = 1, pageSize = 20) {
    const [items, total, unreadCount] = await Promise.all([_Notification.Notification.find({
      recipient: userId
    }).sort({
      createdAt: -1
    }).skip((page - 1) * pageSize).limit(pageSize), _Notification.Notification.countDocuments({
      recipient: userId
    }), _Notification.Notification.countDocuments({
      recipient: userId,
      read: false
    })]);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      unreadCount
    };
  },
  async markRead(notificationId, userId) {
    const notification = await _Notification.Notification.findOneAndUpdate({
      _id: notificationId,
      recipient: userId
    }, {
      read: true,
      readAt: new Date()
    }, {
      new: true
    });
    if (notification) {
      try {
        (0, _gateway.getIO)().to(_sharedTypes.ROOMS.user(userId)).emit(_sharedTypes.SOCKET_EVENTS.NOTIFICATION_READ, {
          id: notification._id.toString()
        });
      } catch {

        /* gateway not initialized, non-fatal */}
    }
    return notification;
  }
};