import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from "react-native";
import { Button, ScreenHeader, Card, Badge } from "@/components/ui";
import { useMyProfile, useMyKharchi, useRequestKharchi } from "./api";
import { colors, spacing } from "@/theme";

const CATEGORIES = ["Food", "Transport", "Tools", "Medical", "Other"];

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function RequestKharchiScreen() {
  const { data: profile } = useMyProfile();
  const { data: kharchi } = useMyKharchi(profile?._id);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const request = useRequestKharchi();

  const submit = async () => {
    if (!profile?.currentSite || !amount || !category || !reason) {
      Alert.alert("Missing information", "Fill in every field before submitting.");
      return;
    }
    try {
      await request.mutateAsync({
        worker: profile._id,
        site: profile.currentSite._id,
        amountRupees: Number(amount),
        date: new Date().toISOString().slice(0, 10),
        category,
        reason
      });
      Alert.alert("Submitted", "Your Kharchi request has been sent for approval.");
      setAmount("");
      setCategory("");
      setReason("");
    } catch (err) {
      Alert.alert("Could not submit", err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <ScreenHeader title="Request Kharchi" subtitle="Daily expense request" />
      <Card style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
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
        <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="e.g. Tools purchase" />
        <Button title={request.isPending ? "Submitting…" : "Submit request"} onPress={submit} variant="accent" />
      </Card>

      <Text style={styles.sectionLabel}>Your requests</Text>
      {kharchi?.map((k) =>
      <View key={k._id} style={styles.requestRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.requestAmount}>{formatINR(Math.round(k.amountPaise / 100))}</Text>
            <Text style={styles.requestReason}>
              {k.category} · {k.reason}
            </Text>
          </View>
          <Badge label={k.status} tone={k.status === "APPROVED" ? "positive" : k.status === "REJECTED" ? "negative" : "amber"} />
        </View>
      )}
    </ScrollView>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  label: { fontSize: 12, fontWeight: "600", color: colors.graphite500, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.steel200, borderRadius: 5, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, color: colors.graphite900 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.steel200, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, fontSize: 12, color: colors.graphite500, overflow: "hidden" },
  chipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", marginBottom: spacing.sm },
  requestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: 5,
    padding: spacing.md,
    marginBottom: spacing.xs
  },
  requestAmount: { fontSize: 14, fontWeight: "700", color: colors.graphite900 },
  requestReason: { fontSize: 12, color: colors.graphite500, marginTop: 2 }
});