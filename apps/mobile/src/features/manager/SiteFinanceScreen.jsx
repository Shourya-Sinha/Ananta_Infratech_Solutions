import { View, Text, ScrollView, StyleSheet, TextInput } from "react-native";
import { toast } from "@/components/Toast";
import { useState } from "react";
import { ScreenHeader, Card, Button, EmptyState } from "@/components/ui";
import { formatINR } from "@/components/interactive";
import { useManagedSites, useSiteFinanceDashboard, useSetSiteBilling } from "./api";
import { useAuthStore } from "@/stores/authStore";
import { currentMonthKey, monthLabel } from "@/lib/salaryDisplay";
import { colors, spacing } from "@/theme";

/**
 * Per-site monthly finance: what the project owner is billed vs everything
 * the site cost (worker salary incl. advance/Kharchi already paid out, other
 * expenses, admin investment) → profit or loss, with a daily approximation.
 * Admin can set the monthly billing; Managers see their own sites read-only.
 */
export function SiteFinanceScreen() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.baseRole ?? user?.role) === "SUPER_ADMIN";
  const { data: sites } = useManagedSites();
  const [siteId, setSiteId] = useState(undefined);
  const [billed, setBilled] = useState("");
  const [received, setReceived] = useState("");
  const month = currentMonthKey();
  const selected = siteId ?? sites?.[0]?._id;
  const { data: dash } = useSiteFinanceDashboard(selected, month);
  const setBilling = useSetSiteBilling();

  const saveBilling = () => {
    const billedAmountRupees = Number(billed);
    if (!selected || !Number.isFinite(billedAmountRupees) || billedAmountRupees < 0) {
      return toast.warning("Enter this month's billing amount (₹)");
    }
    setBilling.mutate(
      { siteId: selected, month, billedAmountRupees, receivedAmountRupees: received === "" ? undefined : Number(received) },
      { onSuccess: () => toast.success("Billing saved"), onError: (e) => toast.error("Could not save", e.message) }
    );
  };

  const pl = dash?.profitLoss.onBilled ?? 0;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Site finance" subtitle={monthLabel(month)} />
      {!sites || sites.length === 0 ? (
        <EmptyState title="No sites" body="Sites you manage will appear here." />
      ) : (
        <>
          <View style={styles.chipRow}>
            {sites.map((s) => (
              <Text key={s._id} onPress={() => setSiteId(s._id)} style={[styles.chip, selected === s._id && styles.chipActive]}>
                {s.name}
              </Text>
            ))}
          </View>

          {dash && (
            <>
              <Card style={{ marginBottom: spacing.md }}>
                <Text style={styles.label}>Profit / loss this month (on billing)</Text>
                <Text style={[styles.hero, { color: pl >= 0 ? colors.teal : colors.rust }]}>{formatINR(pl, { sign: true })}</Text>
                <Text style={styles.meta}>
                  Billed {formatINR(dash.billing.billed)} · Received {formatINR(dash.billing.received)} · Pending{" "}
                  {formatINR(dash.billing.pending)}
                </Text>
                <Text style={styles.meta}>On cash received: {formatINR(dash.profitLoss.onReceived, { sign: true })}</Text>
              </Card>

              <Card style={{ marginBottom: spacing.md }}>
                <Text style={styles.label}>Costs this month</Text>
                <Row label="Worker salary (gross, from attendance)" value={dash.costs.workerSalaryGross} />
                <Row label="Advance + Kharchi already paid (part of salary)" value={dash.costs.advancesAndKharchiPaidOut} />
                <Row label="Salary still payable" value={dash.costs.salaryStillPayable} />
                <Row label="Other site expenses" value={dash.costs.otherSiteExpenses} />
                <Row label="Admin investment" value={dash.costs.adminInvestment} />
                <Row label="Total cost" value={dash.costs.totalCost} bold />
              </Card>

              <Card style={{ marginBottom: spacing.md }}>
                <Text style={styles.label}>Daily approximation</Text>
                <Row label={`Average cost / day (${dash.approximate.elapsedDays} days so far)`} value={dash.approximate.averageDailyCost} />
                <Row label="Projected month cost" value={dash.approximate.projectedMonthCost} />
                <Row label="Projected profit / loss" value={dash.approximate.projectedProfitLossOnBilled} bold />
              </Card>

              {isAdmin && (
                <Card>
                  <Text style={styles.label}>Set this month's billing (Admin)</Text>
                  <TextInput style={styles.input} placeholder="Billed to project owner, ₹ e.g. 200000" placeholderTextColor={colors.graphite300} keyboardType="numeric" value={billed} onChangeText={setBilled} />
                  <TextInput style={styles.input} placeholder="Received so far, ₹ (optional)" placeholderTextColor={colors.graphite300} keyboardType="numeric" value={received} onChangeText={setReceived} />
                  <Button title="Save billing" onPress={saveBilling} loading={setBilling.isPending} />
                </Card>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Row({ label, value, bold }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{formatINR(value ?? 0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg },
  label: { fontSize: 12, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", marginBottom: spacing.sm },
  hero: { fontSize: 30, fontWeight: "800" },
  meta: { fontSize: 12, color: colors.graphite500, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    borderWidth: 1, borderColor: colors.steel200, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12,
    fontSize: 12, color: colors.graphite500, overflow: "hidden"
  },
  chipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: spacing.md },
  rowLabel: { flex: 1, fontSize: 13, color: colors.graphite700 },
  rowValue: { fontSize: 13, fontWeight: "600", color: colors.graphite900 },
  bold: { fontWeight: "800", color: colors.graphite900 },
  input: {
    borderWidth: 1, borderColor: colors.steel200, borderRadius: 10, paddingHorizontal: spacing.md,
    paddingVertical: 10, fontSize: 14, marginBottom: spacing.sm, backgroundColor: colors.surface
  }
});
