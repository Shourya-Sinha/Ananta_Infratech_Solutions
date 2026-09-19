import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/lib/apiClient";
import { SecureTokenStore } from "@/lib/secureStore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const expoPushToken = tokenResponse.data;

    const deviceId = await SecureTokenStore.getOrCreateDeviceId();
    await api.post("/notifications/push-token", { deviceId, expoPushToken });
  } catch {
    // Push registration is a nice-to-have, never block app usage on failure.
  }
}

export function subscribeToForegroundMessages(onMessage) {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    onMessage?.(notification.request.content);
  });
  return () => subscription.remove();
}
