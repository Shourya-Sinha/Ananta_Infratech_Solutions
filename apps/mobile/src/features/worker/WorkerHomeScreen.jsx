import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui";
import { CountUp, PressScale, ProgressBar, formatINR } from "@/components/interactive";
import { useAuthStore } from "@/stores/authStore";
import { useMyProfile, useMyAttendance, useMyStatement } from "./api";
import { currentMonthKey, monthLabel, greeting, todayKeyIST, toRupeeView } from "@/lib/salaryDisplay";
import { colors, spacing, radius, shadow } from "@/theme";

const QUICK_ACTIONS = [
  { label: "Attendance", icon: "calendar-outline", route: "WorkerAttendance", tint: colors.teal },
  { label: "Advance", icon: "cash-outline", route: "RequestAdvance", tint: colors.amber },
  { label: "Kharchi", icon: "receipt-outline", route: "RequestKharchi", tint: colors.rust },
  { label: "Documents", icon: "document-text-outline", route: "WorkerDocuments", tint: colors.graphite500 }
];

export function WorkerHomeScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);

  const { data: profile } = useMyProfile();
  const month = currentMonthKey();
  const today = todayKeyIST();
  const { data: attendance, refetch: refetchAttendance } = useMyAttendance(today, today);
  const { data: statement, refetch: refetchStatement } = useMyStatement(month);
  const pay = toRupeeView(statement);
  const todayRecord = attendance?.[0];
  const recent = (pay?.daily ?? []).flatMap((d) => d.entries.map((e) => ({ ...e, date: d.date }))).slice(0, 4);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([qc.invalidateQueries({ queryKey: ["worker"] }), refetchAttendance(), refetchStatement()]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, refetchAttendance, refetchStatement]);

  const firstName = user?.name?.split(" ")[0] ?? "";
  const needsDocs = profile && profile.verificationStatus !== "ACTIVE" && profile.verificationStatus !== "REJECTED";
  const rejected = profile?.verificationStatus === "REJECTED";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
    >
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greeting()}, {firstName}</Text>
          <Text style={styles.date}>
            {new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date())}
          </Text>
        </View>
        <PressScale onPress={() => navigation.navigate("Notifications")} style={styles.bell} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={20} color={colors.graphite900} />
        </PressScale>
      </Animated.View>

      {needsDocs && (
        <PressScale onPress={() => navigation.navigate("WorkerDocuments")}>
          <Card style={styles.banner}>
            <Ionicons name="alert-circle" size={20} color={colors.amber600} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Complete your registration</Text>
              <Text style={styles.bannerBody}>Upload your ID documents so Admin can activate your account.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.amber600} />
          </Card>
        </PressScale>
      )}
      {rejected && (
        <PressScale onPress={() => navigation.navigate("WorkerDocuments")}>
          <Card style={[styles.banner, styles.bannerRust]}>
            <Ionicons name="close-circle" size={20} color={colors.rust} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Documents need correction</Text>
              <Text style={styles.bannerBody}>Tap to see what needs fixing and re-upload.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.rust} />
          </Card>
        </PressScale>
      )}

      {/* Hero: live net pay for the current calendar month */}
      <Animated.View entering={FadeInDown.delay(60).duration(350)}>
        <PressScale onPress={() => navigation.navigate("WorkerSalary")} accessibilityLabel="Open salary statement">
          <LinearGradient colors={["#1B2027", colors.graphite900]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroKicker}>Net pay · {monthLabel(month)}</Text>
              <View style={styles.liveDot}>
                <View style={styles.liveDotInner} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <CountUp value={pay?.net ?? 0} style={styles.heroAmount} />
            <Text style={styles.heroFormula}>
              Earned {formatINR(pay?.earnings ?? 0)} − advances {formatINR(pay?.advances ?? 0)} − kharchi {formatINR(pay?.kharchi ?? 0)}
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar percent={pay?.netPercent ?? 0} color={colors.amberBright} />
              <Text style={styles.heroHint}>{pay?.netPercent ?? 0}% of earnings kept · tap for statement</Text>
            </View>
          </LinearGradient>
        </PressScale>
      </Animated.View>

      {pay && (pay.pendingAdvance > 0 || pay.pendingKharchi > 0) && (
        <View style={styles.pendingRow}>
          <Ionicons name="hourglass-outline" size={14} color={colors.amber600} />
          <Text style={styles.pendingText}>
            {pay.pendingAdvance > 0 && `Advance ${formatINR(pay.pendingAdvance)} awaiting approval`}
            {pay.pendingAdvance > 0 && pay.pendingKharchi > 0 && " · "}
            {pay.pendingKharchi > 0 && `Kharchi ${formatINR(pay.pendingKharchi)} awaiting approval`}
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <Card style={styles.halfCard} delay={120}>
          <Text style={styles.label}>Today</Text>
          {todayRecord ? (
            <Badge label={todayRecord.status} tone={todayRecord.status === "PRESENT" ? "positive" : "negative"} />
          ) : (
            <Text style={styles.value}>Not marked</Text>
          )}
          <Text style={styles.sub}>{todayRecord?.hoursWorked ?? 0}h worked</Text>
        </Card>
        <Card style={styles.halfCard} delay={160}>
          <Text style={styles.label}>Assigned site</Text>
          <Text style={styles.value} numberOfLines={2}>{profile?.currentSite?.name ?? "Not assigned yet"}</Text>
        </Card>
      </View>

      <Text style={styles.sectionLabel}>Quick actions</Text>
      <View style={styles.actions}>
        {QUICK_ACTIONS.map((a, i) => (
          <Animated.View key={a.route} entering={FadeInDown.delay(180 + i * 40).duration(300)} style={styles.actionWrap}>
            <PressScale onPress={() => navigation.navigate(a.route)} style={[styles.action, shadow.soft]} accessibilityLabel={a.label}>
              <View style={[styles.actionIcon, { backgroundColor: `${a.tint}1A` }]}>
                <Ionicons name={a.icon} size={20} color={a.tint} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </PressScale>
          </Animated.View>
        ))}
      </View>

      {recent.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Latest activity</Text>
          <Card style={{ padding: 0 }}>
            {recent.map((e, i) => (
              <View key={`${e.id ?? i}`} style={[styles.activityRow, i > 0 && styles.activityDivider]}>
                <View style={[styles.activityDot, { backgroundColor: e.direction === "DEBIT" ? colors.rust : colors.teal }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{e.description}</Text>
                  <Text style={styles.activityDate}>{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</Text>
                </View>
                <Text style={[styles.activityAmount, { color: e.direction === "DEBIT" ? colors.rust : colors.teal }]}>
                  {formatINR(e.direction === "DEBIT" ? -e.amountPaise / 100 : e.amountPaise / 100, { sign: true })}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  greet: { fontSize: 20, fontWeight: "700", color: colors.graphite900 },
  date: { fontSize: 12, color: colors.graphite500, marginTop: 2 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow.soft },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md, backgroundColor: colors.amber50, borderColor: colors.amber },
  bannerRust: { backgroundColor: colors.rust50, borderColor: colors.rust },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: colors.graphite900 },
  bannerBody: { fontSize: 12, color: colors.graphite700, marginTop: 2 },
  hero: { borderRadius: radius.xl, padding: spacing.xl, ...shadow.lifted },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroKicker: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  liveDot: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(42,156,143,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  liveDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.tealBright },
  liveText: { fontSize: 10, fontWeight: "700", color: colors.tealBright, letterSpacing: 0.8 },
  heroAmount: { fontSize: 38, fontWeight: "800", color: colors.white, marginTop: spacing.sm, fontVariant: ["tabular-nums"] },
  heroFormula: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  heroHint: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 6 },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.amber50 },
  pendingText: { flex: 1, fontSize: 12, color: colors.amber600, fontWeight: "600" },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  halfCard: { flex: 1, marginBottom: 0 },
  label: { fontSize: 12, color: colors.graphite500, marginBottom: 6 },
  value: { fontSize: 15, fontWeight: "600", color: colors.graphite900 },
  sub: { fontSize: 12, color: colors.graphite500, marginTop: 6 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs },
  actionWrap: { width: "25%", paddingHorizontal: spacing.xs },
  action: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", gap: 6 },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, fontWeight: "600", color: colors.graphite900 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  activityDivider: { borderTopWidth: 1, borderTopColor: colors.steel100 },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityTitle: { fontSize: 13, fontWeight: "600", color: colors.graphite900 },
  activityDate: { fontSize: 11, color: colors.graphite500, marginTop: 2 },
  activityAmount: { fontSize: 13, fontWeight: "700" }
});
