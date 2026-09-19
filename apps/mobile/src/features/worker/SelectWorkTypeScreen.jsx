import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { Button, ScreenHeader, Card } from "@/components/ui";
import { useWorkTypes, useCreateOwnProfile } from "./api";
import { useLogout } from "@/features/auth/api";
import { colors, spacing } from "@/theme";

/**
 * Shown right after a self-registered worker logs in for the first time,
 * before they have a WorkerProfile at all. Backend: POST /workers/me
 * (self-service — see worker.routes.js for why this doesn't need the
 * elevated "worker.create" permission Managers/Admin use instead).
 */
export function SelectWorkTypeScreen() {
  const { data: workTypes, isLoading } = useWorkTypes();
  const [selected, setSelected] = useState("");
  const createProfile = useCreateOwnProfile();
  const logout = useLogout();

  const submit = () => {
    if (!selected) return;
    createProfile.mutate(selected, {
      onError: (err) => Alert.alert("Couldn't save", err instanceof Error ? err.message : "Unknown error"),
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <ScreenHeader
        title="Almost there"
        subtitle="Select your work type to finish setting up your account."
      />

      <Card style={{ gap: spacing.sm }}>
        {isLoading ? (
          <Text style={styles.loading}>Loading work types…</Text>
        ) : (
          <View style={styles.chipRow}>
            {workTypes?.map((wt) => (
              <Text
                key={wt.id}
                onPress={() => setSelected(wt.id)}
                style={[styles.chip, selected === wt.id && styles.chipActive]}
              >
                {wt.name}
              </Text>
            ))}
          </View>
        )}

        <Button
          title={createProfile.isPending ? "Saving…" : "Continue"}
          onPress={submit}
          variant="accent"
          disabled={!selected || createProfile.isPending}
        />
      </Card>

      <Text style={styles.note}>
        Next you'll upload your identity documents. Admin reviews everything before your account is fully activated.
      </Text>

      <Text onPress={() => logout.mutate()} style={styles.signOut}>
        Sign out
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  loading: { fontSize: 13, color: colors.graphite500 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.graphite500,
    overflow: "hidden",
  },
  chipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  note: { fontSize: 12, color: colors.graphite500, marginTop: spacing.lg, textAlign: "center" },
  signOut: { fontSize: 13, color: colors.rust, textAlign: "center", marginTop: spacing.xl, fontWeight: "600" },
});
