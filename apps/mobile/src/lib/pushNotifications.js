import messaging from "@react-native-firebase/messaging";
import { Platform, PermissionsAndroid } from "react-native";
import { api } from "@/lib/apiClient";
import { SecureTokenStore } from "@/lib/secureStore";

/**
 * Push notifications via Firebase Cloud Messaging (pure-RN replacement
 * for expo-notifications). This also fixes the token contract: the API
 * has always expected an FCM token (`POST /notifications/push-token`
 * { deviceId, fcmToken }) and dispatches through Firebase Admin — the
 * old Expo push token could never have been delivered to.
 *
 * Requires android/app/google-services.json (Firebase console) — until
 * that file is added, every call here fails soft and the app runs fine
 * without push.
 */
export async function registerForPushNotifications() {
  try {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) return;

    const fcmToken = await messaging().getToken();
    if (!fcmToken) return;

    const deviceId = await SecureTokenStore.getOrCreateDeviceId();
    await api.post("/notifications/push-token", { deviceId, fcmToken });
  } catch {
    // Push registration is a nice-to-have, never block app usage on failure.
  }
}

/** Foreground messages don't show a system banner — RootNavigator surfaces them. */
export function subscribeToForegroundMessages(onMessage) {
  return messaging().onMessage(async (remoteMessage) => {
    onMessage?.(remoteMessage.notification ?? {});
  });
}
