import { Tab, makeStack, AppTabBar, tabScreenOptions } from "./tabNavigator";
import {
  managerHomeStackScreens,
  managerWorkersStackScreens,
  managerMarkStackScreens,
  managerFinanceStackScreens,
  managerMoreStackScreens
} from "./ManagerNavigator";

const HomeStack = makeStack(managerHomeStackScreens, "ManagerHome");
const WorkersStack = makeStack(managerWorkersStackScreens, "Workers");
const MarkStack = makeStack(managerMarkStackScreens, "MarkAttendance");
const FinanceStack = makeStack(managerFinanceStackScreens, "SiteFinance");
const MoreStack = makeStack(managerMoreStackScreens, "MoreHome");

/**
 * SUPER_ADMIN on mobile: same modern tab shell as Manager, but the API lets
 * Admin work on ANY site, set salary rates and site billing, publish
 * announcements and decide every leave request. The full Admin Panel stays
 * in the Admin Web app (Super-Admin only).
 */
export function AdminNavigator() {
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
