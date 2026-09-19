import { View, Text, FlatList, StyleSheet } from "react-native";
import { ScreenHeader, EmptyState, Card } from "@/components/ui";
import { useMyProfile, useMyLedger, useMySalarySummary } from "./api";
import { colors, spacing, radius } from "@/theme";

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function WorkerSalaryScreen() {
  const { data: profile } = useMyProfile();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data: summary } = useMySalarySummary(profile?._id, month);
  const { data: ledger, isLoading } = useMyLedger(profile?._id);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Salary" subtitle={`${month} summary + full ledger`} />

      {summary &&
      <Card style={{ marginBottom: spacing.md }}>
          <Row label="Gross earnings" value={formatINR(summary.grossEarnings)} />
          <Row label="Overtime" value={formatINR(summary.overtimeEarnings)} />
          <Row label="Advance deductions" value={`-${formatINR(summary.advanceDeductions)}`} negative />
          <Row label="Kharchi deductions" value={`-${formatINR(summary.kharchiDeductions)}`} negative />
          <View style={styles.divider} />
          <Row label="Net salary" value={formatINR(summary.netSalary)} bold />
        </Card>
      }

      <Text style={styles.sectionLabel}>Full ledger</Text>

      {!isLoading && (!ledger || ledger.length === 0) ?
      <EmptyState title="No ledger entries yet" body="Earnings and deductions will appear here as they're posted." /> :

      <FlatList
        data={ledger}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) =>
        <View style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerDesc}>{item.description}</Text>
                <Text style={styles.ledgerDate}>{new Date(item.date).toLocaleDateString("en-IN")}</Text>
              </View>
              <Text style={[styles.ledgerAmount, item.credit > 0 ? { color: colors.teal } : { color: colors.rust }]}>
                {item.credit > 0 ? `+${formatINR(item.credit)}` : `-${formatINR(item.debit)}`}
              </Text>
            </View>
        } />

      }
    </View>);

}

function Row({ label, value, negative, bold }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, negative && { color: colors.rust }, bold && { fontWeight: "700", fontSize: 16 }]}>{value}</Text>
    </View>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: colors.graphite500 },
  summaryValue: { fontSize: 13, fontWeight: "600", color: colors.graphite900 },
  divider: { height: 1, backgroundColor: colors.steel200, marginVertical: spacing.xs },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", marginBottom: spacing.sm },
  ledgerRow: {
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
  ledgerDesc: { fontSize: 13, fontWeight: "600", color: colors.graphite900 },
  ledgerDate: { fontSize: 11, color: colors.graphite500, marginTop: 2 },
  ledgerAmount: { fontSize: 14, fontWeight: "700" }
});