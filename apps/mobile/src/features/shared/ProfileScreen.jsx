import { View, Text, StyleSheet } from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { useLogout } from "@/features/auth/api";
import { Button, ScreenHeader, Card } from "@/components/ui";
import { colors, spacing } from "@/theme";

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" />
      <Card style={{ gap: spacing.sm }}>
        <Row label="Name" value={user?.name ?? "—"} />
        <Row label="Phone" value={user?.phone ?? "—"} />
        <Row label="Role" value={user?.role ?? "—"} />
      </Card>
      <View style={{ height: spacing.lg }} />
      <Button title="Sign out" onPress={() => logout.mutate()} variant="danger" />
    </View>);

}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  label: { fontSize: 13, color: colors.graphite500 },
  value: { fontSize: 13, fontWeight: "600", color: colors.graphite900 }
});