import { Tab, makeStack, AppTabBar, tabScreenOptions } from "./tabNavigator";
import { WorkerHomeScreen } from "@/features/worker/WorkerHomeScreen";
import { WorkerAttendanceScreen } from "@/features/worker/WorkerAttendanceScreen";
import { WorkerSalaryScreen } from "@/features/worker/WorkerSalaryScreen";
import { WorkerDocumentsScreen } from "@/features/worker/WorkerDocumentsScreen";
import { RequestAdvanceScreen } from "@/features/worker/RequestAdvanceScreen";
import { RequestKharchiScreen } from "@/features/worker/RequestKharchiScreen";
import { AnnouncementsScreen } from "@/features/company/AnnouncementsScreen";
import { LeaveScreen } from "@/features/company/LeaveScreen";
import { IdCardScreen } from "@/features/company/IdCardScreen";
import { NotificationsScreen } from "@/features/shared/NotificationsScreen";
import { SupportScreen } from "@/features/shared/SupportScreen";
import { ProfileScreen } from "@/features/shared/ProfileScreen";

const HomeStack = makeStack([
  ["WorkerHome", WorkerHomeScreen, "Home"],
  ["IdCard", IdCardScreen, "My ID Card"]
], "WorkerHome");

const SalaryStack = makeStack([
  ["WorkerSalary", WorkerSalaryScreen, "Salary"]
], "WorkerSalary");

const AttendanceStack = makeStack([
  ["WorkerAttendance", WorkerAttendanceScreen, "Attendance"]
], "WorkerAttendance");

const ServicesStack = makeStack([
  ["ServicesHome", ProfileScreen, "Services"],
  ["WorkerDocuments", WorkerDocumentsScreen, "Documents"],
  ["RequestAdvance", RequestAdvanceScreen, "Advance"],
  ["RequestKharchi", RequestKharchiScreen, "Kharchi"],
  ["Announcements", AnnouncementsScreen, "Announcements"],
  ["Leave", LeaveScreen, "Leave"],
  ["Notifications", NotificationsScreen, "Notifications"],
  ["Support", SupportScreen, "Support"],
  ["IdCard", IdCardScreen, "My ID Card"]
], "ServicesHome");

/**
 * Worker app: Home · Attendance · Salary · Services.
 * Workers only VIEW attendance/salary — marking is Manager/Admin work,
 * enforced again on the API. Everything else lives under Services.
 */
export function WorkerNavigator() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions} tabBar={(props) => <AppTabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeStack} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="Attendance" component={AttendanceStack} options={{ tabBarLabel: "Attendance" }} />
      <Tab.Screen name="Salary" component={SalaryStack} options={{ tabBarLabel: "Salary" }} />
      <Tab.Screen name="Services" component={ServicesStack} options={{ tabBarLabel: "Services" }} />
    </Tab.Navigator>
  );
}
