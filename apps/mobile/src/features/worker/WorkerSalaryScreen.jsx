import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Share } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Card, EmptyState, Button } from "@/components/ui";
import { EarningsBars, SectionTitle } from "@/components/design";
import { CountUp, PressScale, ProgressBar, formatINR } from "@/components/interactive";
import { useMyStatement, useMyReceipts } from "./api";
import { BrandFooter } from "@/components/BrandFooter";
import { currentMonthKey, monthLabel, toRupeeView } from "@/lib/salaryDisplay";
import { colors, spacing, radius, shadow } from "@/theme";

const TYPE_LABEL = {
  EARNING: "Daily wage",
  OVERTIME: "Overtime",
  ADVANCE_DEDUCTION: "Advance",
  KHARCHI_DEDUCTION: "Kharchi",
  ADJUSTMENT: "Adjustment",
  REVERSAL: "Reversal"
};

function shiftMonthKey(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function WorkerSalaryScreen() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonthKey());
  const isCurrentMonth = month === currentMonthKey();
  const { data: statement, isLoading, refetch } = useMyStatement(month);
  const { data: receipts } = useMyReceipts();
  const pay = toRupeeView(statement);
  const [openDay, setOpenDay] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([qc.invalidateQueries({ queryKey: ["worker", "statement"] }), refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, refetch]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
    >
      <View style={styles.monthBar}>
        <PressScale onPress={() => setMonth((m) => shiftMonthKey(m, -1))} style={styles.monthBtn} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={18} color={colors.graphite700} />
        </PressScale>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <PressScale
          onPress={() => !isCurrentMonth && setMonth((m) => shiftMonthKey(m, 1))}
          style={[styles.monthBtn, isCurrentMonth && { opacity: 0.3 }]}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.graphite700} />
        </PressScale>
      </View>

      <Animated.View entering={FadeInDown.duration(300)}>
        <LinearGradient colors={["#1B2027", colors.graphite900]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.kicker}>Take-home · {monthLabel(month)}</Text>
          <CountUp value={pay?.net ?? 0} style={styles.heroAmount} />
          <Text style={styles.heroNote}>Total earnings minus advances and kharchi. Updates as soon as one is taken.</Text>
          {!!pay && (
            <View style={styles.payoutChip}>
              <Ionicons name={pay.payrollStatus === "PAID" ? "checkmark-circle" : "time-outline"} size={13} color={colors.gold} />
              <Text style={styles.payoutChipText}>
                Payout: {pay.payrollStatus === "PAID" ? "Paid" : pay.payrollStatus === "FINALIZED" ? "Finalized — payment pending" : "Live estimate"}
              </Text>
            </View>
          )}
          <View style={{ marginTop: spacing.lg }}>
            <ProgressBar percent={pay?.netPercent ?? 0} color={colors.tealBright} />
            <View style={styles.heroStats}>
              <Stat label="Earnings" value={formatINR(pay?.earnings ?? 0)} />
              <Stat label="Deducted" value={formatINR(pay?.deductions ?? 0)} />
              <Stat label="Kept" value={`${pay?.netPercent ?? 0}%`} />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {pay && (
        <View style={{ marginTop: spacing.md }}>
          <Button
            title="Share salary summary"
            variant="ghost"
            onPress={() =>
              Share.share({
                message: `Ananta Infratech — Salary summary (${monthLabel(month)})\nEarnings: ${formatINR(pay.earnings)} (incl. overtime ${formatINR(pay.overtime)})\nAdvances deducted: ${formatINR(pay.advances)}\nKharchi deducted: ${formatINR(pay.kharchi)}\nNET SALARY: ${formatINR(pay.net)}`
              }).catch(() => {})
            }
          />
        </View>
      )}

      <SectionTitle>Daily net</SectionTitle>
      <Card>
        {(() => {
          const days = (pay?.daily ?? []).slice(0, 14).reverse();
          const total = days.reduce((s, d) => s + d.netPaise, 0) / 100;
          const best = days.reduce((b, d) => (d.netPaise > (b?.netPaise ?? -Infinity) ? d : b), null);
          return (
            <>
              <View style={styles.chartHead}>
                <View>
                  <Text style={styles.chartTotalLabel}>Last {days.length} days total</Text>
                  <Text style={styles.chartTotal}>{formatINR(total)}</Text>
                </View>
                {!!best && best.netPaise > 0 && (
                  <View style={styles.chartChip}>
                    <Text style={styles.chartChipText}>
                      Best: {new Date(`${best.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} · {formatINR(best.netPaise / 100)}
                    </Text>
                  </View>
                )}
              </View>
              <EarningsBars
                data={days.map((d) => ({
                  label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "narrow", timeZone: "UTC" }),
                  sub: String(Number(d.date.slice(8, 10))),
                  value: d.netPaise / 100
                }))}
              />
              {/* Readable amount list — the chart alone is too crowded on
                  small phones, so every day's exact net is also printed here. */}
              <View style={styles.dailyList}>
                {days.map((d) => {
                  const net = d.netPaise / 100;
                  return (
                    <View key={d.date} style={styles.dailyRow}>
                      <Text style={styles.dailyDate}>
                        {new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                      </Text>
                      <View style={[styles.dailyDot, { backgroundColor: net < 0 ? colors.rust : colors.teal }]} />
                      <Text style={[styles.dailyNet, { color: net < 0 ? colors.rust : colors.teal }]}>{formatINR(net, { sign: true })}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          );
        })()}
      </Card>

      {pay && (pay.pendingAdvance > 0 || pay.pendingKharchi > 0) && (
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.pending}>
          <Ionicons name="time-outline" size={16} color={colors.amber600} />
          <Text style={styles.pendingText}>
            Not deducted yet (awaiting approval): {pay.pendingAdvance > 0 ? `advance ${formatINR(pay.pendingAdvance)}` : ""}
            {pay.pendingAdvance > 0 && pay.pendingKharchi > 0 ? ", " : ""}
            {pay.pendingKharchi > 0 ? `kharchi ${formatINR(pay.pendingKharchi)}` : ""}
          </Text>
        </Animated.View>
      )}

      <Text style={styles.sectionLabel}>Breakdown</Text>
      <Card delay={120} style={{ marginBottom: 0 }}>
        <BreakdownRow icon="cash-outline" color={colors.teal} label="Daily wages" value={pay?.gross ?? 0} />
        <BreakdownRow icon="time-outline" color={colors.teal} label="Overtime" value={pay?.overtime ?? 0} />
        <BreakdownRow icon="remove-circle-outline" color={colors.rust} label="Advances" value={-(pay?.advances ?? 0)} percent={pay?.advancePercent} />
        <BreakdownRow icon="remove-circle-outline" color={colors.amber} label="Kharchi" value={-(pay?.kharchi ?? 0)} percent={pay?.kharchiPercent} />
        {(pay?.other ?? 0) > 0 && <BreakdownRow icon="swap-horizontal-outline" color={colors.graphite500} label="Other" value={-pay.other} />}
        <View style={styles.divider} />
        <BreakdownRow icon="wallet-outline" color={colors.graphite900} label="Net salary" value={pay?.net ?? 0} bold />
      </Card>

      {pay?.salaryRates && (
        <>
          <Text style={styles.sectionLabel}>How your pay is calculated</Text>
          <Card delay={140} style={{ marginBottom: 0 }}>
            <BreakdownRow icon="cash-outline" color={colors.graphite900} label="Your per-day wage" value={pay.salaryRates.dailyRatePaise / 100} />
            <BreakdownRow icon="time-outline" color={colors.graphite700} label={`Per hour (÷ ${pay.salaryRates.fullDayHours}h full day)`} value={pay.salaryRates.hourlyRatePaise / 100} />
            {!!pay.attendance && (
              <Text style={styles.calcNote}>
                This month: {pay.attendance.presentDays} present · {pay.attendance.halfDays} half · {pay.attendance.absentDays} absent · {pay.attendance.paidLeaveDays} paid leave
                {pay.attendance.totalHoursWorked ? ` · ${pay.attendance.totalHoursWorked}h worked in total` : ""}. A short day pays only its hours — e.g. 6h = 6 × per-hour rate.
              </Text>
            )}
          </Card>
        </>
      )}

      {pay && pay.dailyAttendance.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Attendance &amp; day pay</Text>
          {pay.dailyAttendance.map((d, i) => (
            <Animated.View key={d.date} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(240)} style={styles.dayCard}>
              <View style={styles.dayHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayDate}>
                    {new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                  </Text>
                  <Text style={styles.dayMeta}>{d.calculation}</Text>
                </View>
                <View style={[styles.attBadge, { backgroundColor: d.totalEarningPaise > 0 ? colors.teal50 : colors.rust50 }]}>
                  <Text style={[styles.attBadgeText, { color: d.totalEarningPaise > 0 ? colors.teal : colors.rust }]}>{d.label}</Text>
                </View>
                <Text style={[styles.dayNet, { color: d.totalEarningPaise > 0 ? colors.teal : colors.rust, marginLeft: spacing.sm }]}>
                  {formatINR(d.totalEarningPaise / 100)}
                </Text>
              </View>
            </Animated.View>
          ))}
          <Text style={styles.calcNote}>Day pay is before any advance/kharchi deducted that day — deductions are in the ledger below.</Text>
        </>
      )}

      {receipts && receipts.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Salary payment receipts</Text>
          {receipts.map((r) => (
            <Card key={r._id} style={{ marginBottom: spacing.sm }}>
              <Text style={styles.dayDate}>
                {r.month} · {formatINR(r.amountPaise / 100)} · {r.method}
              </Text>
              <Text style={styles.dayMeta}>
                {r.transactionId ? `Txn/UTR: ${r.transactionId} · ` : ""}
                {r.paidAt ? new Date(r.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}
                {r.receiptUrl ? " · Receipt image attached (ask Admin to view)" : ""}
              </Text>
            </Card>
          ))}
        </>
      )}

      <Text style={styles.sectionLabel}>Day by day</Text>
      {!isLoading && (!pay || pay.daily.length === 0) ? (
        <EmptyState title="Nothing posted this month" body="Wages, advances and kharchi appear here by day as they happen." />
      ) : (
        (pay?.daily ?? []).map((day, i) => {
          const open = openDay === day.date;
          const net = day.netPaise / 100;
          return (
            <Animated.View key={day.date} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(260)} layout={LinearTransition} style={styles.dayCard}>
              <PressScale onPress={() => setOpenDay(open ? null : day.date)} style={styles.dayHead} accessibilityLabel={`Show entries for ${day.date}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayDate}>
                    {new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                  </Text>
                  <Text style={styles.dayMeta}>
                    {day.entries.length} entr{day.entries.length === 1 ? "y" : "ies"}
                  </Text>
                </View>
                <Text style={[styles.dayNet, { color: net < 0 ? colors.rust : colors.teal }]}>{formatINR(net, { sign: true })}</Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.graphite300} style={{ marginLeft: spacing.sm }} />
              </PressScale>
              {open &&
                day.entries.map((e, j) => (
                  <Animated.View key={e.id ?? j} entering={FadeInDown.duration(200)} style={styles.entryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>{TYPE_LABEL[e.type] ?? e.type}</Text>
                      {!!e.description && <Text style={styles.entryDesc} numberOfLines={2}>{e.description}</Text>}
                    </View>
                    <Text style={[styles.entryAmount, { color: e.direction === "DEBIT" ? colors.rust : colors.teal }]}>
                      {formatINR(e.direction === "DEBIT" ? -e.amountPaise / 100 : e.amountPaise / 100, { sign: true })}
                    </Text>
                  </Animated.View>
                ))}
            </Animated.View>
          );
        })
      )}
      <BrandFooter />
    </ScrollView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BreakdownRow({ icon, color, label, value, percent, bold }) {
  return (
    <View style={styles.breakRow}>
      <View style={[styles.breakIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.breakLabel, bold && { fontWeight: "700", color: colors.graphite900 }]}>{label}</Text>
        {percent !== undefined && percent > 0 && (
          <View style={{ marginTop: 6 }}>
            <ProgressBar percent={percent} color={color} track={colors.steel100} height={4} />
          </View>
        )}
      </View>
      <Text style={[styles.breakValue, bold && { fontSize: 16, fontWeight: "800" }, value < 0 && { color: colors.rust }]}>
        {formatINR(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  monthBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.steel200, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 16, fontWeight: "800", color: colors.graphite900 },
  payoutChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: spacing.sm, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  payoutChipText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  calcNote: { fontSize: 12, color: colors.graphite500, lineHeight: 17, marginTop: spacing.sm },
  attBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  attBadgeText: { fontSize: 11, fontWeight: "800" },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { borderRadius: radius.xl, padding: spacing.xl, ...shadow.lifted },
  kicker: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  heroAmount: { fontSize: 40, fontWeight: "800", color: colors.white, marginTop: spacing.xs, fontVariant: ["tabular-nums"] },
  heroNote: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  heroStats: { flexDirection: "row", marginTop: spacing.md, gap: spacing.sm },
  statValue: { fontSize: 14, fontWeight: "700", color: colors.white },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  pending: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.amber50 },
  pendingText: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.amber600 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm },
  chartHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  chartTotalLabel: { fontSize: 10, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", letterSpacing: 0.5 },
  chartTotal: { fontSize: 19, fontWeight: "800", color: colors.graphite900, marginTop: 2, fontVariant: ["tabular-nums"] },
  chartChip: { backgroundColor: colors.teal50, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  chartChipText: { fontSize: 11, fontWeight: "800", color: colors.teal },
  dailyList: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.steel100 },
  dailyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.steel100 },
  dailyDate: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.graphite900 },
  dailyDot: { width: 7, height: 7, borderRadius: 4 },
  dailyNet: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  breakRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  breakIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  breakLabel: { fontSize: 14, color: colors.graphite700 },
  breakValue: { fontSize: 14, fontWeight: "700", color: colors.graphite900, fontVariant: ["tabular-nums"] },
  divider: { height: 1, backgroundColor: colors.steel200, marginVertical: spacing.xs },
  dayCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.steel200, marginBottom: spacing.sm, overflow: "hidden" },
  dayHead: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  dayDate: { fontSize: 14, fontWeight: "600", color: colors.graphite900 },
  dayMeta: { fontSize: 11, color: colors.graphite500, marginTop: 2 },
  dayNet: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  entryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.steel100, backgroundColor: colors.paper },
  entryTitle: { fontSize: 13, fontWeight: "600", color: colors.graphite900 },
  entryDesc: { fontSize: 12, color: colors.graphite500, marginTop: 2 },
  entryAmount: { fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }
});
