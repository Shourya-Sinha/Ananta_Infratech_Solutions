const { PushToken } = require("../../db/models/PushToken");
const { logger } = require("../../config/logger");
const { env } = require("../../config/env");

let firebaseAdmin = null;
let firebaseInitAttempted = false;

/**
 * Lazily initializes the Firebase Admin SDK from a service account JSON
 * blob in FIREBASE_SERVICE_ACCOUNT_JSON. Returns null (and logs once) if
 * unconfigured — push dispatch degrades to a no-op rather than crashing
 * the server, same pattern as SmsService for an unconfigured SMS provider.
 */
function getFirebaseAdmin() {
  if (firebaseInitAttempted) return firebaseAdmin;
  firebaseInitAttempted = true;

  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    logger.warn(
      "FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications will be logged, not sent. " +
        "See README 'Push notifications setup' to configure a real Firebase project."
    );
    return null;
  }

  try {
    // eslint-disable-next-line global-require
    const admin = require("firebase-admin");
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseAdmin = admin;
    return firebaseAdmin;
  } catch (err) {
    logger.error({ err }, "Failed to initialize Firebase Admin SDK");
    return null;
  }
}

exports.PushNotificationService = {
  async registerToken(userId, deviceId, fcmToken) {
    if (!fcmToken || typeof fcmToken !== "string" || fcmToken.length < 10) {
      logger.warn({ fcmToken }, "Rejected push token registration: malformed FCM token");
      return;
    }
    await PushToken.findOneAndUpdate({ user: userId, deviceId }, { fcmToken }, { upsert: true });
  },

  async unregisterToken(userId, deviceId) {
    await PushToken.deleteOne({ user: userId, deviceId });
  },

  /**
   * Dispatches a push notification to every device registered for this
   * user via Firebase Cloud Messaging. Never throws — a push delivery
   * failure must not block the underlying business operation (e.g. an
   * advance approval) that already succeeded and was already persisted as
   * an in-app Notification.
   */
  async dispatch(userId, payload) {
    if (!env.PUSH_NOTIFICATIONS_ENABLED) return;

    const admin = getFirebaseAdmin();
    if (!admin) return;

    try {
      const tokens = await PushToken.find({ user: userId });
      if (tokens.length === 0) return;

      const message = {
        notification: { title: payload.title, body: payload.body },
        data: Object.fromEntries(
          Object.entries(payload.data ?? {}).map(([k, v]) => [k, String(v)])
        ),
        tokens: tokens.map((t) => t.fcmToken),
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Prune tokens FCM reports as invalid/unregistered so we don't keep
      // hitting them on every future notification.
      const staleTokens = [];
      response.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code;
          if (code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered") {
            staleTokens.push(message.tokens[i]);
          }
        }
      });
      if (staleTokens.length > 0) {
        await PushToken.deleteMany({ fcmToken: { $in: staleTokens } });
      }
    } catch (err) {
      logger.error({ err, userId }, "Push notification dispatch threw");
    }
  },
};
