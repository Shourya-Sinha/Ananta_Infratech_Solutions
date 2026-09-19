import { View, Text, FlatList, StyleSheet, TextInput } from "react-native";
import { useState } from "react";
import { ScreenHeader, EmptyState, Badge } from "@/components/ui";
import { useManagedWorkers } from "./api";
import { colors, spacing, radius } from "@/theme";

export function ManagerWorkersScreen() {
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
        renderItem={({ item }) =>
        <View style={styles.row}>
              <View>
                <Text style={styles.name}>{item.user.name}</Text>
                <Text style={styles.meta}>
                  {item.employeeId} · {item.workType?.name ?? "—"}
                </Text>
              </View>
              <Badge label={item.user.phone} tone="neutral" />
            </View>
        } />

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
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs
  },
  name: { fontSize: 14, fontWeight: "600", color: colors.graphite900 },
  meta: { fontSize: 12, color: colors.graphite500, marginTop: 2 }
});