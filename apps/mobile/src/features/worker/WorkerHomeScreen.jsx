import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ScreenHeader, Card, Badge } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useMyProfile, useMyAttendance, useMySalarySummary } from "./api";
import { colors, spacing } from "@/theme";

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function WorkerHomeScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useMyProfile();

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: attendance } = useMyAttendance(today, today);
  const { data: salary } = useMySalarySummary(profile?._id, month);

  const todayRecord = attendance?.[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <ScreenHeader title={`Good morning, ${user?.name?.split(" ")[0] ?? ""}`} />

      {profile && profile.verificationStatus !== "ACTIVE" && profile.verificationStatus !== "REJECTED" &&
      <Pressable onPress={() => navigation.navigate("WorkerDocuments")}>
          <Card style={styles.verificationBanner}>
            <Text style={styles.verificationTitle}>Complete your registration</Text>
            <Text style={styles.verificationBody}>
              Upload your identity documents so Admin can verify and activate your account. Tap to continue.
            </Text>
          </Card>
        </Pressable>
      }

      {profile?.verificationStatus === "REJECTED" &&
      <Pressable onPress={() => navigation.navigate("WorkerDocuments")}>
          <Card style={styles.rejectedBanner}>
            <Text style={styles.verificationTitle}>Documents need correction</Text>
            <Text style={styles.verificationBody}>Tap to see what needs fixing and re-upload.</Text>
          </Card>
        </Pressable>
      }

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={styles.label}>Assigned site</Text>
        <Text style={styles.value}>{profile?.currentSite?.name ?? "Not assigned yet"}</Text>
      </Card>

      <View style={styles.row}>
        <Card style={styles.halfCard}>
          <Text style={styles.label}>Today's status</Text>
          {todayRecord ? <Badge label={todayRecord.status} tone={todayRecord.status === "PRESENT" ? "positive" : "negative"} /> : <Text style={styles.value}>Not marked</Text>}
        </Card>
        <Card style={styles.halfCard}>
          <Text style={styles.label}>Today's hours</Text>
          <Text style={styles.value}>{todayRecord?.hoursWorked ?? 0}h</Text>
        </Card>
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.sectionTitle}>This month</Text>
        <SummaryRow label="Gross earnings" value={salary ? formatINR(salary.grossEarnings) : "—"} />
        <SummaryRow label="Overtime" value={salary ? formatINR(salary.overtimeEarnings) : "—"} />
        <SummaryRow label="Advance deductions" value={salary ? `-${formatINR(salary.advanceDeductions)}` : "—"} negative />
        <SummaryRow label="Kharchi deductions" value={salary ? `-${formatINR(salary.kharchiDeductions)}` : "—"} negative />
        <View style={styles.divider} />
        <SummaryRow label="Net salary" value={salary ? formatINR(salary.netSalary) : "—"} bold />
      </Card>

      <Text style={styles.sectionLabel}>Quick actions</Text>
      <View style={styles.actionsGrid}>
        <ActionChip label="Attendance" onPress={() => navigation.navigate("WorkerAttendance")} />
        <ActionChip label="Salary" onPress={() => navigation.navigate("WorkerSalary")} />
        <ActionChip label="Documents" onPress={() => navigation.navigate("WorkerDocuments")} />
        <ActionChip label="Advance" onPress={() => navigation.navigate("RequestAdvance")} />
        <ActionChip label="Kharchi" onPress={() => navigation.navigate("RequestKharchi")} />
      </View>
    </ScrollView>);

}

function SummaryRow({ label, value, negative, bold }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, negative && { color: colors.rust }, bold && { fontWeight: "700", fontSize: 16 }]}>
        {value}
      </Text>
    </View>);

}

function ActionChip({ label, onPress }) {
  return (
    <Text onPress={onPress} style={styles.actionChip}>
      {label}
    </Text>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  label: { fontSize: 12, color: colors.graphite500, marginBottom: 4 },
  verificationBanner: { marginBottom: spacing.md, backgroundColor: colors.amber50, borderColor: colors.amber },
  rejectedBanner: { marginBottom: spacing.md, backgroundColor: colors.rust50, borderColor: colors.rust },
  verificationTitle: { fontSize: 14, fontWeight: "700", color: colors.graphite900 },
  verificationBody: { fontSize: 12, color: colors.graphite700, marginTop: 4 },
  value: { fontSize: 16, fontWeight: "600", color: colors.graphite900 },
  row: { flexDirection: "row", gap: spacing.sm },
  halfCard: { flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.graphite900, marginBottom: spacing.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: colors.graphite500 },
  summaryValue: { fontSize: 13, fontWeight: "600", color: colors.graphite900 },
  divider: { height: 1, backgroundColor: colors.steel200, marginVertical: spacing.xs },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    fontSize: 13,
    fontWeight: "600",
    color: colors.graphite900,
    overflow: "hidden"
  }
});