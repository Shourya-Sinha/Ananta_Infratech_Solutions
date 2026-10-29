import { View, Text, ScrollView, StyleSheet, TextInput } from "react-native";
import { toast } from "@/components/Toast";
import { useState } from "react";
import { ScreenHeader, Card, Button, EmptyState } from "@/components/ui";
import { formatINR } from "@/components/interactive";
import { useManagedWorkers, useWorkerSalaryPreview, useSetSalaryRate } from "./api";
import { currentMonthKey } from "@/lib/salaryDisplay";
import { colors, spacing, radius } from "@/theme";

const MODES = [
  { key: "HOURLY", label: "Per hour", hint: "e.g. ₹100/hr → ₹800/day" },
  { key: "DAILY", label: "Per day", hint: "e.g. ₹800/day" },
  { key: "MONTHLY", label: "Per month", hint: "e.g. ₹26,000/mo → ₹1,000/day" }
];

/**
 * Manager/Admin sets a worker's pay in ONE basis; the API derives the other
 * two and every figure (today, monthly approx) updates everywhere. Workers
 * never see this screen — the API also rejects worker-set rates.
 */
export function SetSalaryRateScreen() {
  const { data: workers } = useManagedWorkers();
  const [workerId, setWorkerId] = useState(undefined);
  const [mode, setMode] = useState("DAILY");
  const [amount, setAmount] = useState("");
  const month = currentMonthKey();
  const selected = workerId ?? workers?.[0]?._id;
  const { data: preview } = useWorkerSalaryPreview(selected, month);
  const setRate = useSetSalaryRate();

  const save = () => {
    const amountRupees = Number(amount);
    if (!selected) return toast.warning("Select a worker first");
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) return toast.warning("Enter a valid amount in rupees");
    setRate.mutate(
      { workerId: selected, mode, amountRupees },
      {
        onSuccess: (rates) =>
          toast.success(
            "Salary rate saved",
            `Per hour ${formatINR(rates.hourlyRatePaise / 100)} · Per day ${formatINR(rates.dailyRatePaise / 100)} · Per month approx ${formatINR(rates.monthlySalaryPaise / 100)}`
          ),
        onError: (e) => toast.error("Could not save", e.message)
      }
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Set salary rate" subtitle="Set one — hour, day and month are calculated automatically" />
      {!workers || workers.length === 0 ? (
        <EmptyState title="No workers" body="Workers on your sites will appear here." />
      ) : (
        <>
          <Text style={styles.label}>Worker</Text>
          <View style={styles.chipRow}>
            {workers.map((w) => (
              <Text key={w._id} onPress={() => setWorkerId(w._id)} style={[styles.chip, selected === w._id && styles.chipActive]}>
                {w.user.name}
              </Text>
            ))}
          </View>

          {preview && (
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={styles.label}>Current rate ({preview.rates.mode.replaceAll("_", " ").toLowerCase()})</Text>
              <Text style={styles.big}>
                {formatINR(preview.rates.hourlyRatePaise / 100)}/hr · {formatINR(preview.rates.dailyRatePaise / 100)}/day ·{" "}
                {formatINR(preview.rates.monthlySalaryPaise / 100)}/mo
              </Text>
              <Text style={styles.meta}>
                Today earned {formatINR(preview.today.netPaise / 100)} · This month so far{" "}
                {formatINR(preview.monthSoFar.netSalaryPaise / 100)} · Approx monthly net{" "}
                {formatINR(preview.approximateMonthlyNetPaise / 100)}
              </Text>
            </Card>
          )}

          <Text style={styles.label}>Set rate as</Text>
          <View style={styles.chipRow}>
            {MODES.map((m) => (
              <Text key={m.key} onPress={() => setMode(m.key)} style={[styles.chip, mode === m.key && styles.chipActive]}>
                {m.label}
              </Text>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder={MODES.find((m) => m.key === mode).hint}
            placeholderTextColor={colors.graphite300}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <Button title="Save rate" onPress={save} loading={setRate.isPending} />
          <Text style={styles.meta}>New rate applies to attendance marked from now on. Past salary is not changed.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg },
  label: { fontSize: 12, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    borderWidth: 1, borderColor: colors.steel200, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12,
    fontSize: 12, color: colors.graphite500, overflow: "hidden"
  },
  chipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  big: { fontSize: 15, fontWeight: "700", color: colors.graphite900 },
  meta: { fontSize: 12, color: colors.graphite500, marginTop: 6 },
  input: {
    borderWidth: 1, borderColor: colors.steel200, borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: 12, fontSize: 16, marginBottom: spacing.md, backgroundColor: colors.surface
  }
});
