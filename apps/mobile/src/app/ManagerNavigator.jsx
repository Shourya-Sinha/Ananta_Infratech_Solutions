import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ManagerHomeScreen } from "@/features/manager/ManagerHomeScreen";
import { ManagerWorkersScreen } from "@/features/manager/ManagerWorkersScreen";
import { MarkAttendanceScreen } from "@/features/manager/MarkAttendanceScreen";
import { AddWorkerScreen } from "@/features/manager/AddWorkerScreen";
import { SubmitAdvanceScreen } from "@/features/manager/SubmitAdvanceScreen";
import { SubmitKharchiScreen } from "@/features/manager/SubmitKharchiScreen";
import { NotificationsScreen } from "@/features/shared/NotificationsScreen";
import { SupportScreen } from "@/features/shared/SupportScreen";
import { ProfileScreen } from "@/features/shared/ProfileScreen";
import { colors } from "@/theme";

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.graphite900, fontSize: 16, fontWeight: "700" },
  headerTintColor: colors.graphite900,
  contentStyle: { backgroundColor: colors.paper }
};

export function ManagerNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ManagerHome" component={ManagerHomeScreen} options={{ title: "Home" }} />
      <Stack.Screen name="Workers" component={ManagerWorkersScreen} options={{ title: "Workers" }} />
      <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} options={{ title: "Mark Attendance" }} />
      <Stack.Screen name="AddWorker" component={AddWorkerScreen} options={{ title: "Add Worker" }} />
      <Stack.Screen name="SubmitAdvance" component={SubmitAdvanceScreen} options={{ title: "Request Advance" }} />
      <Stack.Screen name="SubmitKharchi" component={SubmitKharchiScreen} options={{ title: "Request Kharchi" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="Support" component={SupportScreen} options={{ title: "Support" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>);

}