import { NavigationContainer } from "@react-navigation/native";
import { View, ActivityIndicator, Alert } from "react-native";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { AuthNavigator } from "./AuthNavigator";
import { ManagerNavigator } from "./ManagerNavigator";
import { WorkerOnboardingGate } from "./WorkerOnboardingGate";
import { OfflineAttendanceQueue } from "@/offline/attendanceQueue";
import { registerForPushNotifications, subscribeToForegroundMessages } from "@/lib/pushNotifications";
import { colors } from "@/theme";

export function RootNavigator() {
  const { accessToken, user, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Attempt an offline-queue sync on app launch, in case actions were queued
  // during a previous session that ended while still offline (spec §45).
  useEffect(() => {
    if (accessToken) OfflineAttendanceQueue.syncPending();
  }, [accessToken]);

  // Register for push notifications once we have a valid session. Runs on
  // every launch with a token present; registerForPushNotifications() is an
  // idempotent upsert on the backend so this is safe to repeat.
  useEffect(() => {
    if (accessToken && user) registerForPushNotifications();
  }, [accessToken, user]);

  // FCM doesn't automatically display a system notification while the app
  // is in the foreground on either platform — surface it ourselves.
  useEffect(() => {
    const unsubscribe = subscribeToForegroundMessages((content) => {
      const title = content?.title ?? "New notification";
      const body = content?.body ?? "";
      Alert.alert(title, body);
    });
    return unsubscribe;
  }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>);

  }

  return (
    <NavigationContainer>
      {!accessToken || !user ?
      <AuthNavigator /> :
      user.role === "MANAGER" ?
      <ManagerNavigator /> :

      <WorkerOnboardingGate />
      }
    </NavigationContainer>);

}