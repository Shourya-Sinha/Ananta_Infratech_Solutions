import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WorkerHomeScreen } from "@/features/worker/WorkerHomeScreen";
import { WorkerAttendanceScreen } from "@/features/worker/WorkerAttendanceScreen";
import { WorkerSalaryScreen } from "@/features/worker/WorkerSalaryScreen";
import { WorkerDocumentsScreen } from "@/features/worker/WorkerDocumentsScreen";
import { RequestAdvanceScreen } from "@/features/worker/RequestAdvanceScreen";
import { RequestKharchiScreen } from "@/features/worker/RequestKharchiScreen";
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

export function WorkerNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="WorkerHome" component={WorkerHomeScreen} options={{ title: "Home" }} />
      <Stack.Screen name="WorkerAttendance" component={WorkerAttendanceScreen} options={{ title: "Attendance" }} />
      <Stack.Screen name="WorkerSalary" component={WorkerSalaryScreen} options={{ title: "Salary" }} />
      <Stack.Screen name="WorkerDocuments" component={WorkerDocumentsScreen} options={{ title: "Documents" }} />
      <Stack.Screen name="RequestAdvance" component={RequestAdvanceScreen} options={{ title: "Advance" }} />
      <Stack.Screen name="RequestKharchi" component={RequestKharchiScreen} options={{ title: "Kharchi" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="Support" component={SupportScreen} options={{ title: "Support" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>);

}