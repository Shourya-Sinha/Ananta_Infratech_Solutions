import { View, Text, ScrollView, StyleSheet, TextInput } from "react-native";
import { toast } from "@/components/Toast";
import { useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ScreenHeader, Card, Button, EmptyState, Badge } from "@/components/ui";
import { useMyLeaves, useRequestLeave, useCancelLeave, useDecideLeave } from "./api";
import { useAuthStore } from "@/stores/authStore";
import { colors, spacing, radius } from "@/theme";

const STATUS_TONE = { REQUESTED: "amber", APPROVED: "positive", REJECTED: "negative", CANCELLED: "neutral" };
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Worker: request leave + history. Manager/Admin: approve/reject queue. */
export function LeaveScreen() {
  const user = useAuthStore((s) => s.user);
  const role = user?.baseRole ?? user?.role;
  const isWorker = role === "WORKER";
  const { data } = useMyLeaves();
  const request = useRequestLeave();
  const cancel = useCancelLeave();
  const decide = useDecideLeave();
  const [form, setForm] = useState({ fromDate: "", toDate: "", leaveType: "PAID", reason: "" });

  const submit = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(form.toDate)) {
      return toast.warning("Enter dates as YYYY-MM-DD", "Example: 2026-08-15");
    }
    request.mutate(form, {
      onSuccess: () => { setForm({ fromDate: "", toDate: "", leaveType: "PAID", reason: "" }); toast.success("Leave requested", "Your manager/admin will approve or reject it."); },
      onError: (e) => toast.error("Could not request", e.message)
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title={isWorker ? "Leave" : "Leave requests"} subtitle={isWorker ? "Approved paid leave is credited to your salary automatically" : "Approving creates the attendance (and paid-leave salary) for those days"} />

      {isWorker && (
        <Card style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          <TextInput editable={!request.isPending} style={styles.input} placeholder="From date (YYYY-MM-DD)" placeholderTextColor={colors.graphite300} value={form.fromDate} onChangeText={(v) => setForm({ ...form, fromDate: v })} />
          <TextInput editable={!request.isPending} style={styles.input} placeholder="To date (YYYY-MM-DD)" placeholderTextColor={colors.graphite300} value={form.toDate} onChangeText={(v) => setForm({ ...form, toDate: v })} />
          <View style={styles.chipRow}>
            {["PAID", "UNPAID"].map((t) => (
              <Text key={t} onPress={() => setForm({ ...form, leaveType: t })} style={[styles.chip, form.leaveType === t && styles.chipActive]}>{t} leave</Text>
            ))}
          </View>
          <TextInput editable={!request.isPending} style={styles.input} placeholder="Reason (optional)" placeholderTextColor={colors.graphite300} value={form.reason} onChangeText={(v) => setForm({ ...form, reason: v })} />
          <Button title="Request leave" onPress={submit} loading={request.isPending} />
        </Card>
      )}

      {!data || data.length === 0 ? (
        <EmptyState title="No leave requests" body={isWorker ? "Your leave requests will appear here." : "Pending requests from your workers will appear here."} />
      ) : (
        data.map((l, i) => (
          <Animated.View key={l._id} entering={FadeInDown.delay(Math.min(i, 8) * 45).duration(280)}>
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{fmt(l.fromDate)} → {fmt(l.toDate)}</Text>
                <Badge label={l.status} tone={STATUS_TONE[l.status]} />
              </View>
              {!isWorker && l.worker?.user?.name && <Text style={styles.meta}>{l.worker.user.name} · {l.worker.employeeId ?? ""}</Text>}
              <Text style={styles.meta}>{l.leaveType} leave{l.reason ? ` · ${l.reason}` : ""}</Text>
              {l.status === "APPROVED" && <Text style={styles.meta}>Attendance created for {l.attendanceCreated} day(s)</Text>}
              {l.decisionNote && <Text style={styles.meta}>Note: {l.decisionNote}</Text>}
              {isWorker && l.status === "REQUESTED" && (
                <Text style={styles.cancel} onPress={() => cancel.mutate(l._id)}>Cancel request</Text>
              )}
              {!isWorker && l.status === "REQUESTED" && (
                <View style={styles.actions}>
                  <View style={{ flex: 1 }}><Button title="Approve" onPress={() => decide.mutate({ id: l._id, approve: true })} loading={decide.isPending} /></View>
                  <View style={{ flex: 1 }}><Button title="Reject" variant="danger" onPress={() => decide.mutate({ id: l._id, approve: false })} loading={decide.isPending} /></View>
                </View>
              )}
            </Card>
          </Animated.View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg },
  input: { borderWidth: 1, borderColor: colors.steel200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, backgroundColor: colors.surface, color: colors.graphite900 },
  chipRow: { flexDirection: "row", gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.steel200, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, fontSize: 12, color: colors.graphite500, overflow: "hidden" },
  chipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 14, fontWeight: "800", color: colors.graphite900 },
  meta: { fontSize: 12, color: colors.graphite500, marginTop: 4 },
  cancel: { fontSize: 12, fontWeight: "700", color: colors.rust, marginTop: 8 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }
});
