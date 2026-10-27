import { View, Text, Pressable, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useEffect } from "react";
import * as Haptics from "@/lib/haptics";
import { colors, spacing, radius, shadow } from "@/theme";

export const Tab = createBottomTabNavigator();
export const Stack = createNativeStackNavigator();

export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.graphite900, fontSize: 16, fontWeight: "800" },
  headerTintColor: colors.graphite900,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.paper },
  animation: "slide_from_right"
};

/** Wraps screens into a stack with the shared header style. */
export function makeStack(screens, initial) {
  return function StackNavigator() {
    return (
      <Stack.Navigator screenOptions={stackScreenOptions} initialRouteName={initial}>
        {screens.map(([name, component, title]) => (
          <Stack.Screen key={name} name={name} component={component} options={{ title: title ?? name }} />
        ))}
      </Stack.Navigator>
    );
  };
}

const ICONS = {
  Home: ["home", "home-outline"],
  Attendance: ["calendar", "calendar-outline"],
  Salary: ["wallet", "wallet-outline"],
  Workers: ["people", "people-outline"],
  Mark: ["checkmark-circle", "checkmark-circle-outline"],
  Finance: ["stats-chart", "stats-chart-outline"],
  Services: ["grid", "grid-outline"],
  More: ["ellipsis-horizontal-circle", "ellipsis-horizontal-circle-outline"],
  Profile: ["person-circle", "person-circle-outline"]
};

/** Floating tab bar with a springy active pill. */
export function AppTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key].options.tabBarLabel ?? route.name;
          const [activeIcon, inactiveIcon] = ICONS[route.name] ?? ["ellipse", "ellipse-outline"];
          return (
            <TabButton
              key={route.key}
              focused={focused}
              label={label}
              icon={focused ? activeIcon : inactiveIcon}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({ focused, label, icon, onPress, onLongPress }) {
  const scale = useSharedValue(focused ? 1 : 0.85);
  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.85, { damping: 14, stiffness: 220 });
  }, [focused, scale]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: focused ? 1 : 0 }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.tab} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, pillStyle]} />
        <Animated.View style={iconStyle}>
          <Ionicons name={icon} size={21} color={focused ? colors.white : colors.graphite300} />
        </Animated.View>
      </View>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

export const tabScreenOptions = { headerShown: false };

const styles = StyleSheet.create({
  barWrap: { backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingTop: 6 },
  bar: {
    flexDirection: "row", backgroundColor: colors.navy, borderRadius: radius.xl,
    paddingVertical: 8, paddingHorizontal: 6, ...shadow.lifted
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  iconWrap: { width: 44, height: 30, alignItems: "center", justifyContent: "center" },
  pill: { position: "absolute", width: 44, height: 30, borderRadius: 15, backgroundColor: colors.amber },
  label: { fontSize: 10, fontWeight: "600", color: colors.graphite300 },
  labelActive: { color: colors.white, fontWeight: "800" }
});
