import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { Button, ScreenHeader, EmptyState } from "@/components/ui";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useManagedSites, useManagedWorkers, useMarkAttendance } from "./api";
import { colors, spacing, radius } from "@/theme";

export function MarkAttendanceScreen() {
  const { data: sites } = useManagedSites();
  const { data: workers } = useManagedWorkers();
  const [siteId, setSiteId] = useState(undefined);
  const today = new Date().toISOString().slice(0, 10);
  const markAttendance = useMarkAttendance();

  const activeSite = siteId ?? sites?.[0]?._id;
  const [rows, setRows] = useState({});

  const updateRow = (workerId, patch) => {
    setRows((prev) => {
      const base = prev[workerId] ?? { status: null, hoursWorked: "8", overtimeHours: "0" };
      return { ...prev, [workerId]: { ...base, ...patch } };
    });
  };

  const saveWorker = async (worker) => {
    if (!activeSite) return;
    const row = rows[worker._id];
    if (!row?.status) {
      Alert.alert("Select status", "Mark Present or Absent before saving.");
      return;
    }

    const result = await markAttendance.mutateAsync({
      worker: worker._id,
      site: activeSite,
      date: today,
      status: row.status,
      hoursWorked: row.status === "PRESENT" ? Number(row.hoursWorked) || 0 : 0,
      overtimeHours: row.status === "PRESENT" ? Number(row.overtimeHours) || 0 : 0
    });

    Alert.alert(
      result.queued ? "Saved offline" : "Saved",
      result.queued ? "Will sync once you're back online." : `${worker.user.name} marked ${row.status.toLowerCase()}.`
    );
  };

  if (!workers || workers.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Mark attendance" />
        <EmptyState title="No workers assigned" body="Workers assigned to your sites will appear here." />
      </View>);

  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <ScreenHeader title="Mark attendance" subtitle={`Today · ${today}`} />

      {sites && sites.length > 1 &&
      <View style={styles.siteRow}>
          {sites.map((s) =>
        <Text
          key={s._id}
          onPress={() => setSiteId(s._id)}
          style={[styles.siteChip, activeSite === s._id && styles.siteChipActive]}>
          
              {s.name}
            </Text>
        )}
        </View>
      }

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {workers.map((worker) => {
          const row = rows[worker._id] ?? { status: null, hoursWorked: "8", overtimeHours: "0" };
          return (
            <View key={worker._id} style={styles.workerCard}>
              <View style={styles.workerHeader}>
                <Text style={styles.workerName}>{worker.user.name}</Text>
                <Text style={styles.workerMeta}>{worker.workType?.name ?? "—"}</Text>
              </View>

              <View style={styles.statusRow}>
                <Pressable
                  style={[styles.statusButton, row.status === "PRESENT" && styles.statusButtonActivePositive]}
                  onPress={() => updateRow(worker._id, { status: "PRESENT" })}>
                  
                  <Text style={[styles.statusButtonText, row.status === "PRESENT" && styles.statusButtonTextActive]}>
                    Present
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.statusButton, row.status === "ABSENT" && styles.statusButtonActiveNegative]}
                  onPress={() => updateRow(worker._id, { status: "ABSENT" })}>
                  
                  <Text style={[styles.statusButtonText, row.status === "ABSENT" && styles.statusButtonTextActive]}>
                    Absent
                  </Text>
                </Pressable>
              </View>

              {row.status === "PRESENT" &&
              <View style={styles.hoursRow}>
                  <View style={styles.hoursField}>
                    <Text style={styles.hoursLabel}>Hours</Text>
                    <TextInput
                    style={styles.hoursInput}
                    keyboardType="numeric"
                    value={row.hoursWorked}
                    onChangeText={(v) => updateRow(worker._id, { hoursWorked: v })} />
                  
                  </View>
                  <View style={styles.hoursField}>
                    <Text style={styles.hoursLabel}>Overtime</Text>
                    <TextInput
                    style={styles.hoursInput}
                    keyboardType="numeric"
                    value={row.overtimeHours}
                    onChangeText={(v) => updateRow(worker._id, { overtimeHours: v })} />
                  
                  </View>
                </View>
              }

              <Button title="Save" onPress={() => saveWorker(worker)} variant="primary" disabled={!row.status} />
            </View>);

        })}
      </ScrollView>
    </View>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  siteRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  siteChip: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    color: colors.graphite500,
    overflow: "hidden"
  },
  siteChipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  workerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm
  },
  workerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workerName: { fontSize: 15, fontWeight: "600", color: colors.graphite900 },
  workerMeta: { fontSize: 12, color: colors.graphite500 },
  statusRow: { flexDirection: "row", gap: spacing.sm },
  statusButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center"
  },
  statusButtonActivePositive: { backgroundColor: colors.teal50, borderColor: colors.teal },
  statusButtonActiveNegative: { backgroundColor: colors.rust50, borderColor: colors.rust },
  statusButtonText: { fontSize: 13, fontWeight: "600", color: colors.graphite500 },
  statusButtonTextActive: { color: colors.graphite900 },
  hoursRow: { flexDirection: "row", gap: spacing.sm },
  hoursField: { flex: 1 },
  hoursLabel: { fontSize: 11, color: colors.graphite500, marginBottom: 4 },
  hoursInput: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.graphite900
  }
});