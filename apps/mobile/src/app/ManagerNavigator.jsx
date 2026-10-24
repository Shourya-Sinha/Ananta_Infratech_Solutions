import { Tab, makeStack, AppTabBar, tabScreenOptions } from "./tabNavigator";
import { ManagerHomeScreen } from "@/features/manager/ManagerHomeScreen";
import { ManagerWorkersScreen } from "@/features/manager/ManagerWorkersScreen";
import { MarkAttendanceScreen } from "@/features/manager/MarkAttendanceScreen";
import { AddWorkerScreen } from "@/features/manager/AddWorkerScreen";
import { SubmitAdvanceScreen } from "@/features/manager/SubmitAdvanceScreen";
import { SubmitKharchiScreen } from "@/features/manager/SubmitKharchiScreen";
import { SetSalaryRateScreen } from "@/features/manager/SetSalaryRateScreen";
import { SiteFinanceScreen } from "@/features/manager/SiteFinanceScreen";
import { AnnouncementsScreen } from "@/features/company/AnnouncementsScreen";
import { LeaveScreen } from "@/features/company/LeaveScreen";
import { NotificationsScreen } from "@/features/shared/NotificationsScreen";
import { SupportScreen } from "@/features/shared/SupportScreen";
import { ProfileScreen } from "@/features/shared/ProfileScreen";

export const managerHomeStackScreens = [
  ["ManagerHome", ManagerHomeScreen, "Home"],
  ["MarkAttendance", MarkAttendanceScreen, "Mark Attendance"],
  ["SiteFinance", SiteFinanceScreen, "Site Finance"]
];
export const managerWorkersStackScreens = [
  ["Workers", ManagerWorkersScreen, "Workers"],
  ["SetSalaryRate", SetSalaryRateScreen, "Set Salary Rate"],
  ["AddWorker", AddWorkerScreen, "Add Worker"]
];
export const managerMarkStackScreens = [
  ["MarkAttendance", MarkAttendanceScreen, "Mark Attendance"]
];
export const managerFinanceStackScreens = [
  ["SiteFinance", SiteFinanceScreen, "Site Finance"]
];
export const managerMoreStackScreens = [
  ["MoreHome", ProfileScreen, "More"],
  ["SubmitAdvance", SubmitAdvanceScreen, "Request Advance"],
  ["SubmitKharchi", SubmitKharchiScreen, "Request Kharchi"],
  ["Leave", LeaveScreen, "Leave Requests"],
  ["Announcements", AnnouncementsScreen, "Announcements"],
  ["Notifications", NotificationsScreen, "Notifications"],
  ["Support", SupportScreen, "Support"]
];

const HomeStack = makeStack(managerHomeStackScreens, "ManagerHome");
const WorkersStack = makeStack(managerWorkersStackScreens, "Workers");
const MarkStack = makeStack(managerMarkStackScreens, "MarkAttendance");
const FinanceStack = makeStack(managerFinanceStackScreens, "SiteFinance");
const MoreStack = makeStack(managerMoreStackScreens, "MoreHome");

/** Manager app: Home · Workers · Mark · Finance · More. Own sites only (API-enforced). */
export function ManagerNavigator() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions} tabBar={(props) => <AppTabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeStack} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="Workers" component={WorkersStack} options={{ tabBarLabel: "Workers" }} />
      <Tab.Screen name="Mark" component={MarkStack} options={{ tabBarLabel: "Mark" }} />
      <Tab.Screen name="Finance" component={FinanceStack} options={{ tabBarLabel: "Finance" }} />
      <Tab.Screen name="More" component={MoreStack} options={{ tabBarLabel: "More" }} />
    </Tab.Navigator>
  );
}
