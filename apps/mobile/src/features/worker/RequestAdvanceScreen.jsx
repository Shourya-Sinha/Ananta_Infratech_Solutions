import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from "react-native";
import { Button, ScreenHeader, Card, Badge } from "@/components/ui";
import { useMyProfile, useMyAdvances, useRequestAdvance } from "./api";
import { colors, spacing } from "@/theme";

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function RequestAdvanceScreen() {
  const { data: profile } = useMyProfile();
  const { data: advances } = useMyAdvances(profile?._id);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const request = useRequestAdvance();

  const submit = async () => {
    if (!profile || !amount || !reason) {
      Alert.alert("Missing information", "Enter an amount and reason.");
      return;
    }
    try {
      await request.mutateAsync({
        worker: profile._id,
        amountRupees: Number(amount),
        reason,
        requestedDate: new Date().toISOString().slice(0, 10)
      });
      Alert.alert("Submitted", "Your advance request has been sent for approval.");
      setAmount("");
      setReason("");
    } catch (err) {
      Alert.alert("Could not submit", err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <ScreenHeader title="Request advance" />
      <Card style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
        <Text style={styles.label}>Amount (₹)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="2000" />
        <Text style={styles.label}>Reason</Text>
        <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="e.g. Family medical expense" />
        <Button title={request.isPending ? "Submitting…" : "Submit request"} onPress={submit} variant="accent" />
      </Card>

      <Text style={styles.sectionLabel}>Your requests</Text>
      {advances?.map((a) =>
      <View key={a._id} style={styles.requestRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.requestAmount}>{formatINR(Math.round(a.amountPaise / 100))}</Text>
            <Text style={styles.requestReason}>{a.reason}</Text>
          </View>
          <Badge label={a.status} tone={a.status === "APPROVED" || a.status === "PAID" ? "positive" : a.status === "REJECTED" ? "negative" : "amber"} />
        </View>
      )}
    </ScrollView>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  label: { fontSize: 12, fontWeight: "600", color: colors.graphite500, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.steel200, borderRadius: 5, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, color: colors.graphite900 },
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