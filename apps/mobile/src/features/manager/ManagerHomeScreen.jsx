import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useState, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import { ScreenHeader, Card } from "@/components/ui";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useManagedSites, useManagedWorkers, useTodayAttendance } from "./api";
import { useAuthStore } from "@/stores/authStore";
import { colors, spacing, radius } from "@/theme";

export function ManagerHomeScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { data: sites } = useManagedSites();
  const { data: workers } = useManagedWorkers();
  const [selectedSite, setSelectedSite] = useState(undefined);
  const today = new Date().toISOString().slice(0, 10);

  const siteId = selectedSite ?? sites?.[0]?._id;
  const { data: attendance } = useTodayAttendance(siteId, today);

  const stats = useMemo(() => {
    const total = workers?.length ?? 0;
    const marked = attendance?.length ?? 0;
    const present = attendance?.filter((a) => a.status === "PRESENT").length ?? 0;
    const absent = attendance?.filter((a) => a.status === "ABSENT").length ?? 0;
    const overtime = attendance?.filter((a) => a.overtimeHours > 0).length ?? 0;
    return { total, marked, present, absent, overtime, notMarked: total - marked };
  }, [workers, attendance]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OfflineBanner />
      <ScreenHeader title={`Good day, ${user?.name?.split(" ")[0] ?? ""}`} subtitle="Today's workforce" />

      {sites && sites.length > 1 &&
      <View style={styles.siteRow}>
          {sites.map((s) =>
        <Text
          key={s._id}
          onPress={() => setSelectedSite(s._id)}
          style={[styles.siteChip, siteId === s._id && styles.siteChipActive]}>
          
              {s.name}
            </Text>
        )}
        </View>
      }

      <View style={styles.statGrid}>
        <StatCard label="Present" value={stats.present} tone="positive" />
        <StatCard label="Absent" value={stats.absent} tone="negative" />
        <StatCard label="Not marked" value={stats.notMarked} tone="neutral" />
        <StatCard label="Overtime" value={stats.overtime} tone="amber" />
      </View>

      <Text style={styles.sectionLabel}>Quick actions</Text>
      <View style={styles.actionsGrid}>
        <ActionButton label="Mark attendance" onPress={() => navigation.navigate("MarkAttendance")} />
        <ActionButton label="Add worker" onPress={() => navigation.navigate("AddWorker")} />
        <ActionButton label="Request advance" onPress={() => navigation.navigate("SubmitAdvance")} />
        <ActionButton label="Request Kharchi" onPress={() => navigation.navigate("SubmitKharchi")} />
      </View>
    </ScrollView>);

}

function StatCard({ label, value, tone }) {
  const color = tone === "positive" ? colors.teal : tone === "negative" ? colors.rust : tone === "amber" ? colors.amber : colors.graphite900;
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </Card>);

}

function ActionButton({ label, onPress }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  siteRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  siteChip: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    color: colors.graphite500,
    overflow: "hidden"
  },
  siteChipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  statCard: { width: "47%", padding: spacing.md },
  statLabel: { fontSize: 12, color: colors.graphite500, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: "700" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", marginBottom: spacing.sm },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    width: "47%"
  },
  actionButtonText: { fontSize: 14, fontWeight: "600", color: colors.graphite900, textAlign: "center" }
});