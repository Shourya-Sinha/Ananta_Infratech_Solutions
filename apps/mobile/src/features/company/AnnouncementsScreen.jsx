import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from "react-native";
import { useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader, Card, Button, EmptyState, Badge } from "@/components/ui";
import { useAnnouncements, useManageAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from "./api";
import { useAuthStore } from "@/stores/authStore";
import { colors, spacing, radius } from "@/theme";

const AUDIENCES = ["ALL", "WORKERS", "MANAGERS"];

/** Company notice board. Admin (SUPER_ADMIN) can publish/pin/delete from here too. */
export function AnnouncementsScreen() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.baseRole ?? user?.role) === "SUPER_ADMIN";
  const { data } = useAnnouncements();
  const { data: managed } = useManageAnnouncements(isAdmin);
  const create = useCreateAnnouncement();
  const remove = useDeleteAnnouncement();
  const [form, setForm] = useState({ title: "", body: "", audience: "ALL", pinned: false });
  const [showForm, setShowForm] = useState(false);

  const list = isAdmin && managed ? managed : data;

  const publish = () => {
    if (form.title.trim().length < 3 || form.body.trim().length < 3) return Alert.alert("Add a title and message");
    create.mutate(form, {
      onSuccess: () => { setForm({ title: "", body: "", audience: "ALL", pinned: false }); setShowForm(false); Alert.alert("Published", "Everyone in the selected audience can now see this notice."); },
      onError: (e) => Alert.alert("Could not publish", e?.response?.data?.message ?? e.message)
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Announcements" subtitle="Official notices from Ananta Infratech" />
      {isAdmin && (
        <>
          <Button title={showForm ? "Close" : "＋ New announcement"} variant="accent" onPress={() => setShowForm((v) => !v)} />
          {showForm && (
            <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <TextInput style={styles.input} placeholder="Title e.g. Holiday on 15 Aug" placeholderTextColor={colors.graphite300} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
              <TextInput style={[styles.input, { minHeight: 76, textAlignVertical: "top" }]} multiline placeholder="Message for the team…" placeholderTextColor={colors.graphite300} value={form.body} onChangeText={(v) => setForm({ ...form, body: v })} />
              <View style={styles.chipRow}>
                {AUDIENCES.map((a) => (
                  <Text key={a} onPress={() => setForm({ ...form, audience: a })} style={[styles.chip, form.audience === a && styles.chipActive]}>{a}</Text>
                ))}
                <Text onPress={() => setForm({ ...form, pinned: !form.pinned })} style={[styles.chip, form.pinned && styles.chipActive]}>📌 Pin</Text>
              </View>
              <Button title="Publish announcement" onPress={publish} loading={create.isPending} />
            </Card>
          )}
          <View style={{ height: spacing.md }} />
        </>
      )}

      {!list || list.length === 0 ? (
        <EmptyState title="No announcements" body="Company notices will appear here." />
      ) : (
        list.map((a, i) => (
          <Animated.View key={a._id} entering={FadeInDown.delay(Math.min(i, 8) * 50).duration(300)}>
            <Card style={[styles.notice, a.pinned && styles.noticePinned]}>
              <View style={styles.noticeHead}>
                <Ionicons name={a.pinned ? "pin" : "megaphone-outline"} size={16} color={a.pinned ? colors.amber600 : colors.teal} />
                <Text style={styles.noticeTitle}>{a.title}</Text>
                {a.pinned && <Badge label="PINNED" tone="amber" />}
              </View>
              <Text style={styles.noticeBody}>{a.body}</Text>
              <View style={styles.noticeFoot}>
                <Text style={styles.noticeMeta}>{new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {a.audience}</Text>
                {isAdmin && (
                  <Text style={styles.delete} onPress={() => Alert.alert("Delete announcement?", a.title, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => remove.mutate(a._id) }
                  ])}>Delete</Text>
                )}
              </View>
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.steel200, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, fontSize: 12, color: colors.graphite500, overflow: "hidden" },
  chipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  notice: { marginBottom: spacing.sm },
  noticePinned: { borderWidth: 1.5, borderColor: colors.amber },
  noticeHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  noticeTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.graphite900 },
  noticeBody: { fontSize: 13, color: colors.graphite700, lineHeight: 19 },
  noticeFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  noticeMeta: { fontSize: 11, color: colors.graphite300 },
  delete: { fontSize: 12, fontWeight: "700", color: colors.rust }
});
