import { View, Text, FlatList, StyleSheet, TextInput, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Avatar } from "@/components/design";
import { formatINR } from "@/components/interactive";
import { BrandFooter } from "@/components/BrandFooter";
import { useState } from "react";
import { ScreenHeader, EmptyState } from "@/components/ui";
import { useManagedWorkers } from "./api";
import { colors, spacing, radius } from "@/theme";

export function ManagerWorkersScreen() {
  const navigation = useNavigation();
  const { data: workers, isLoading } = useManagedWorkers();
  const [search, setSearch] = useState("");

  const filtered = (workers ?? []).filter((w) => w.user.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={styles.container}>
      <ScreenHeader title="Workers" subtitle={`${workers?.length ?? 0} assigned to your sites`} />
      <TextInput
        style={styles.search}
        placeholder="Search workers…"
        placeholderTextColor={colors.graphite300}
        value={search}
        onChangeText={setSearch} />
      

      {!isLoading && filtered.length === 0 ?
      <EmptyState title="No workers found" body="Workers assigned to your sites will appear here." /> :

      <FlatList
        data={filtered}
        keyExtractor={(w) => w._id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListFooterComponent={<BrandFooter />}
        renderItem={({ item }) => {
          const dailyPaise = item.dailyRatePaise ?? item.workType?.defaultDailyRatePaise ?? 0;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              onPress={() => navigation.navigate("SetSalaryRate")}
              accessibilityLabel={`Set salary rate for ${item.user.name}`}
            >
              <Avatar name={item.user.name} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.user.name}</Text>
                <Text style={styles.meta}>
                  {item.employeeId} · {item.workType?.name ?? "—"}{item.currentSite?.name ? ` · ${item.currentSite.name}` : ""}
                </Text>
                <View style={styles.chips}>
                  <View style={styles.wageChip}>
                    <Ionicons name="cash-outline" size={12} color={colors.teal} />
                    <Text style={styles.wageText}>
                      {dailyPaise ? `${formatINR(dailyPaise / 100)}/day` : "Rate not set"}
                      {item.dailyRatePaise ? "" : " (standard)"}
                    </Text>
                  </View>
                  <Text style={styles.phone}>{item.user.phone}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.graphite300} />
            </Pressable>
          );
        }} />

      }
    </View>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  search: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: spacing.md,
    backgroundColor: colors.surface
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs
  },
  name: { fontSize: 14, fontWeight: "700", color: colors.graphite900 },
  chips: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 6 },
  wageChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.teal50, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  wageText: { fontSize: 11, fontWeight: "800", color: colors.teal },
  phone: { fontSize: 11, color: colors.graphite300 },
  meta: { fontSize: 12, color: colors.graphite500, marginTop: 2 }
});