import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useMemo, useState } from "react";
import { ScreenHeader, Card, Badge } from "@/components/ui";
import { StatTile, SectionTitle, MonthCalendar } from "@/components/design";
import { PressScale } from "@/components/interactive";
import { useMyAttendance } from "./api";
import { useHolidays } from "@/features/company/api";
import { todayKeyIST } from "@/lib/salaryDisplay";
import { colors, spacing } from "@/theme";

const LEGEND = [
  ["PRESENT", "Present", colors.teal], ["HALF_DAY", "Half day", colors.sky],
  ["LEAVE_PAID", "Paid leave", colors.violet], ["ABSENT", "Absent", colors.rust], ["HOLIDAY", "Holiday", colors.gold]
];

/** Month calendar view of the worker's attendance (view-only; manager marks it). */
export function WorkerAttendanceScreen() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayKeyIST());
  const { from, to } = useMemo(() => ({
    from: `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-01`,
    to: `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(new Date(cursor.y, cursor.m + 1, 0).getDate()).padStart(2, "0")}`
  }), [cursor]);
  const { data } = useMyAttendance(from, to);
  const { data: holidays } = useHolidays(from, to);

  const byDay = useMemo(() => {
    const map = {};
    for (const a of data ?? []) map[new Date(a.date).toISOString().slice(0, 10)] = a;
    return map;
  }, [data]);
  const holidaySet = useMemo(() => new Set((holidays ?? []).map((h) => new Date(h.date).toISOString().slice(0, 10))), [holidays]);
  const holidayByDay = useMemo(() => Object.fromEntries((holidays ?? []).map((h) => [new Date(h.date).toISOString().slice(0, 10), h])), [holidays]);

  const summary = useMemo(() => {
    const s = { present: 0, absent: 0, leave: 0, ot: 0 };
    for (const a of data ?? []) {
      if (a.status === "PRESENT" || a.status === "HALF_DAY") s.present += 1;
      else if (a.status === "ABSENT") s.absent += 1;
      else if (a.status?.startsWith("LEAVE")) s.leave += 1;
      s.ot += a.overtimeHours ?? 0;
    }
    return s;
  }, [data]);

  const move = (dir) => setCursor((c) => {
    const d = new Date(c.y, c.m + dir, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const selRecord = byDay[selected];
  const selHoliday = holidayByDay[selected];
  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Attendance" subtitle="Marked by your Manager/Admin — view only" />

      <View style={styles.monthBar}>
        <PressScale onPress={() => move(-1)} style={styles.arrow}><Text style={styles.arrowText}>‹</Text></PressScale>
        <Text style={styles.monthName}>{monthName}</Text>
        <PressScale onPress={() => move(1)} style={styles.arrow}><Text style={styles.arrowText}>›</Text></PressScale>
      </View>

      <Card>
        <MonthCalendar year={cursor.y} month={cursor.m} days={Object.fromEntries(Object.entries(byDay).map(([k, v]) => [k, v.status]))} holidays={holidaySet} selected={selected} onSelect={setSelected} />
        <View style={styles.legend}>
          {LEGEND.map(([key, label, tint]) => (
            <View key={key} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: tint }]} /><Text style={styles.legendText}>{label}</Text></View>
          ))}
        </View>
      </Card>

      <View style={styles.tileRow}>
        <StatTile delay={60} icon="checkmark-circle" tint={colors.teal} label="Present / half" value={String(summary.present)} />
        <StatTile delay={100} icon="close-circle" tint={colors.rust} label="Absent" value={String(summary.absent)} />
        <StatTile delay={140} icon="airplane" tint={colors.violet} label="Leave" value={String(summary.leave)} />
        <StatTile delay={180} icon="time" tint={colors.amber} label="Overtime" value={`${Math.round(summary.ot * 10) / 10}h`} />
      </View>

      <SectionTitle>{new Date(`${selected}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</SectionTitle>
      <Card>
        {selHoliday && <Text style={styles.detailTitle}>🎉 {selHoliday.name} (company holiday)</Text>}
        {selRecord ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.detailTitle}>{selRecord.status.replace("_", " ")}</Text>
              <Badge label={selRecord.status} tone={selRecord.status === "PRESENT" ? "positive" : selRecord.status === "ABSENT" ? "negative" : "neutral"} />
            </View>
            <Text style={styles.detailMeta}>
              {selRecord.hoursWorked ?? 0}h worked{selRecord.overtimeHours > 0 ? ` · ${selRecord.overtimeHours}h overtime` : ""} · {selRecord.site?.name ?? "site"} · marked by manager/admin
            </Text>
          </>
        ) : !selHoliday ? (
          <Text style={styles.detailMeta}>No attendance marked for this day yet.</Text>
        ) : null}
      </Card>
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg },
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  arrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  arrowText: { fontSize: 20, fontWeight: "800", color: colors.graphite900 },
  monthName: { fontSize: 16, fontWeight: "800", color: colors.graphite900 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.graphite500 },
  tileRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  detailTitle: { fontSize: 14, fontWeight: "800", color: colors.graphite900 },
  detailMeta: { fontSize: 12, color: colors.graphite500, marginTop: 4 }
});
