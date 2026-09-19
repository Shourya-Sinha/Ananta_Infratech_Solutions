import { Text, StyleSheet } from "react-native";
import Animated, { SlideInDown, SlideOutUp } from "react-native-reanimated";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { colors, spacing } from "@/theme";

export function OfflineBanner() {
  const { isOffline, pendingCount } = useOfflineStatus();

  if (!isOffline && pendingCount === 0) return null;

  return (
    <Animated.View
      entering={SlideInDown.duration(250)}
      exiting={SlideOutUp.duration(200)}
      style={[styles.banner, isOffline ? styles.offline : styles.syncing]}
    >
      <Text style={styles.text}>
        {isOffline
          ? "You're offline. Attendance will be saved and synced automatically once you're back online."
          : `Syncing ${pendingCount} pending attendance ${pendingCount === 1 ? "entry" : "entries"}…`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 10, marginBottom: spacing.sm },
  offline: { backgroundColor: colors.rust50 },
  syncing: { backgroundColor: colors.amber50 },
  text: { fontSize: 12, color: colors.graphite700, textAlign: "center" },
});
