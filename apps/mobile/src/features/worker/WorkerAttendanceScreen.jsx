import { View, Text, FlatList, StyleSheet } from "react-native";
import { useMemo } from "react";
import { ScreenHeader, EmptyState, Badge } from "@/components/ui";
import { useMyAttendance } from "./api";
import { colors, spacing, radius } from "@/theme";

export function WorkerAttendanceScreen() {
  const { from, to } = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    return { from: first, to: today };
  }, []);

  const { data, isLoading } = useMyAttendance(from, to);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Attendance" subtitle="This month" />
      {!isLoading && (!data || data.length === 0) ?
      <EmptyState title="No attendance yet" body="Your attendance records will appear here once your manager marks them." /> :

      <FlatList
        data={data}
        keyExtractor={(a) => a.date}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) =>
        <View style={styles.row}>
              <View>
                <Text style={styles.date}>{new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Text>
                <Text style={styles.hours}>
                  {item.hoursWorked}h worked{item.overtimeHours > 0 ? ` · ${item.overtimeHours}h overtime` : ""}
                </Text>
              </View>
              <Badge label={item.status} tone={item.status === "PRESENT" ? "positive" : item.status === "ABSENT" ? "negative" : "neutral"} />
            </View>
        } />

      }
    </View>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs
  },
  date: { fontSize: 14, fontWeight: "600", color: colors.graphite900 },
  hours: { fontSize: 12, color: colors.graphite500, marginTop: 2 }
});