import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from "react-native";
import { Button, ScreenHeader, Card } from "@/components/ui";
import { useManagedWorkers, useManagedSites, useSubmitKharchiOnBehalf } from "./api";
import { colors, spacing } from "@/theme";

const CATEGORIES = ["Food", "Transport", "Tools", "Medical", "Other"];

export function SubmitKharchiScreen({ navigation }) {
  const { data: workers } = useManagedWorkers();
  const { data: sites } = useManagedSites();
  const [workerId, setWorkerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const submit = useSubmitKharchiOnBehalf();

  const onSubmit = async () => {
    if (!workerId || !siteId || !amount || !category || !reason) {
      Alert.alert("Missing information", "Fill in every field before submitting.");
      return;
    }
    try {
      await submit.mutateAsync({
        worker: workerId,
        site: siteId,
        amountRupees: Number(amount),
        date: new Date().toISOString().slice(0, 10),
        category,
        reason
      });
      Alert.alert("Submitted", "Kharchi request submitted for admin approval.");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Could not submit", err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <ScreenHeader title="Request Kharchi" subtitle="Daily expense, on behalf of a worker" />
      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.label}>Worker</Text>
        <View style={styles.chipRow}>
          {workers?.map((w) =>
          <Text key={w._id} onPress={() => setWorkerId(w._id)} style={[styles.chip, workerId === w._id && styles.chipActive]}>
              {w.user.name}
            </Text>
          )}
        </View>

        <Text style={styles.label}>Site</Text>
        <View style={styles.chipRow}>
          {sites?.map((s) =>
          <Text key={s._id} onPress={() => setSiteId(s._id)} style={[styles.chip, siteId === s._id && styles.chipActive]}>
              {s.name}
            </Text>
          )}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) =>
          <Text key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
              {c}
            </Text>
          )}
        </View>

        <Text style={styles.label}>Amount (₹)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="300" />

        <Text style={styles.label}>Reason</Text>
        <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="e.g. Lunch for site team" />

        <Button title={submit.isPending ? "Submitting…" : "Submit request"} onPress={onSubmit} variant="accent" />
      </Card>
    </ScrollView>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  label: { fontSize: 12, fontWeight: "600", color: colors.graphite500, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.steel200, borderRadius: 5, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, color: colors.graphite900 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.steel200, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, fontSize: 12, color: colors.graphite500, overflow: "hidden" },
  chipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 }
});