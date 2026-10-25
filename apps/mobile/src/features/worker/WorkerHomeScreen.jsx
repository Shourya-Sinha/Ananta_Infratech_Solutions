import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui";
import { CountUp, PressScale, ProgressBar, formatINR } from "@/components/interactive";
import { GradientHero, Avatar, StatTile, ActionTile, SectionTitle, EarningsBars } from "@/components/design";
import { useAuthStore } from "@/stores/authStore";
import { useMyProfile, useMyAttendance, useMyStatement, useMySalaryPreview } from "./api";
import { useAnnouncements } from "@/features/company/api";
import { currentMonthKey, monthLabel, greeting, todayKeyIST, toRupeeView } from "@/lib/salaryDisplay";
import { colors, spacing, shadow } from "@/theme";

const go = (navigation, tab, screen) => navigation.navigate(tab, { screen });

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
  const { data: preview } = useMySalaryPreview(month);
  const { data: announcements } = useAnnouncements();
  const pay = toRupeeView(statement);
  const todayRecord = attendance?.[0];
  const topNotice = announcements?.[0];

  const last7 = (pay?.daily ?? []).slice(0, 7).reverse().map((d) => ({
    label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
    value: d.netPaise / 100
  }));
  const last7Total = last7.reduce((s, d) => s + d.value, 0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([qc.invalidateQueries({ queryKey: ["worker"] }), qc.invalidateQueries({ queryKey: ["company"] }), refetchAttendance(), refetchStatement()]); }
    finally { setRefreshing(false); }
  }, [qc, refetchAttendance, refetchStatement]);

  const firstName = user?.name?.split(" ")[0] ?? "";
  const needsDocs = profile && profile.verificationStatus !== "ACTIVE" && profile.verificationStatus !== "REJECTED";
  const rejected = profile?.verificationStatus === "REJECTED";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <Avatar name={user?.name ?? "?"} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greeting()}, {firstName}</Text>
          <Text style={styles.date}>
            {new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date())}
            {profile?.currentSite?.name ? ` · ${profile.currentSite.name}` : ""}
          </Text>
        </View>
        <PressScale onPress={() => go(navigation, "Services", "Notifications")} style={styles.bell} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={20} color={colors.graphite900} />
        </PressScale>
        <PressScale onPress={() => go(navigation, "Home", "IdCard")} style={styles.bell} accessibilityLabel="My ID card">
          <Ionicons name="id-card-outline" size={20} color={colors.graphite900} />
        </PressScale>
      </Animated.View>

      {needsDocs && (
        <PressScale onPress={() => go(navigation, "Services", "WorkerDocuments")}>
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
        <PressScale onPress={() => go(navigation, "Services", "WorkerDocuments")}>
          <Card style={[styles.banner, styles.bannerRust]}>
            <Ionicons name="close-circle" size={20} color={colors.rust} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Documents need correction</Text>
              <Text style={styles.bannerBody}>Tap to see what needs fixing and re-upload.</Text>
            </View>
          </Card>
        </PressScale>
      )}

      {/* Salary hero */}
      <Animated.View entering={FadeInDown.delay(60).duration(350)}>
        <PressScale onPress={() => navigation.navigate("Salary")} accessibilityLabel="Open salary statement">
          <GradientHero>
            <View style={styles.heroTop}>
              <Text style={styles.heroKicker}>Net pay · {monthLabel(month)}</Text>
              <View style={styles.liveDot}><PulseDot /><Text style={styles.liveText}>LIVE</Text></View>
            </View>
            <CountUp value={pay?.net ?? 0} style={styles.heroAmount} />
            <Text style={styles.heroFormula}>Earned {formatINR(pay?.earnings ?? 0)} − advances {formatINR(pay?.advances ?? 0)} − kharchi {formatINR(pay?.kharchi ?? 0)}</Text>
            <ProgressBar percent={pay?.netPercent ?? 0} color={colors.gold} />
            <Text style={styles.heroHint}>{pay?.netPercent ?? 0}% of earnings kept · tap for full statement</Text>
            <View style={styles.heroStats}>
              <HeroStat label="Today" value={formatINR((preview?.today.netPaise ?? 0) / 100)} />
              <HeroStat label="Approx month" value={formatINR((preview?.approximateMonthlyNetPaise ?? 0) / 100)} />
              <HeroStat label="Per day" value={formatINR((preview?.rates.dailyRatePaise ?? 0) / 100)} />
            </View>
          </GradientHero>
        </PressScale>
      </Animated.View>

      {/* Today + site */}
      <View style={styles.tileRow}>
        <StatTile delay={100} icon={todayRecord ? "checkmark-circle" : "time"} tint={todayRecord?.status === "ABSENT" ? colors.rust : colors.teal}
          label="Today's attendance" value={todayRecord ? todayRecord.status.replace("_", " ") : "Not marked"}
          sub={todayRecord ? `${todayRecord.hoursWorked ?? 0}h worked · by manager` : "Your manager marks it"} />
        <StatTile delay={140} icon="location" tint={colors.sky} label="Assigned site" value={profile?.currentSite?.name ?? "Not assigned"} sub={profile?.workType?.name ?? ""} />
      </View>

      {/* Last 7 days earnings */}
      <SectionTitle actionLabel="Statement →" onAction={() => navigation.navigate("Salary")}>Last days · earnings</SectionTitle>
      <Card delay={160}>
        <View style={styles.chartHead}>
          <View>
            <Text style={styles.chartTotalLabel}>Last {last7.length || 7} days total</Text>
            <Text style={styles.chartTotal}>{formatINR(last7Total)}</Text>
          </View>
          <View style={styles.chartChip}>
            <Text style={styles.chartChipText}>{formatINR((preview?.rates.hourlyRatePaise ?? 0) / 100)}/hr</Text>
          </View>
        </View>
        <EarningsBars data={last7} />
        <Text style={styles.chartHint}>Amount above each bar is that day's net pay, after the day's deductions · approx {formatINR((preview?.rates.monthlySalaryPaise ?? 0) / 100)}/month at this rate</Text>
      </Card>

      {/* Announcement */}
      {topNotice && (
        <>
          <SectionTitle actionLabel="All notices →" onAction={() => go(navigation, "Services", "Announcements")}>Company notice</SectionTitle>
          <PressScale onPress={() => go(navigation, "Services", "Announcements")}>
            <Card delay={180} style={topNotice.pinned ? styles.noticePinned : undefined}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Ionicons name={topNotice.pinned ? "pin" : "megaphone-outline"} size={16} color={colors.amber600} />
                <Text style={styles.noticeTitle}>{topNotice.title}</Text>
              </View>
              <Text style={styles.noticeBody} numberOfLines={2}>{topNotice.body}</Text>
            </Card>
          </PressScale>
        </>
      )}

      {/* Quick actions */}
      <SectionTitle>Quick actions</SectionTitle>
      <View style={styles.actions}>
        <ActionTile delay={200} label="Attendance" icon="calendar-outline" tint={colors.teal} onPress={() => navigation.navigate("Attendance")} />
        <ActionTile delay={230} label="Advance" icon="cash-outline" tint={colors.amber} onPress={() => go(navigation, "Services", "RequestAdvance")} />
        <ActionTile delay={260} label="Kharchi" icon="receipt-outline" tint={colors.rust} onPress={() => go(navigation, "Services", "RequestKharchi")} />
        <ActionTile delay={290} label="Leave" icon="airplane-outline" tint={colors.violet} onPress={() => go(navigation, "Services", "Leave")} />
        <ActionTile delay={320} label="Documents" icon="document-text-outline" tint={colors.sky} onPress={() => go(navigation, "Services", "WorkerDocuments")} />
        <ActionTile delay={350} label="ID Card" icon="id-card-outline" tint={colors.gold} onPress={() => go(navigation, "Home", "IdCard")} />
        <ActionTile delay={380} label="Notices" icon="megaphone-outline" tint={colors.teal} onPress={() => go(navigation, "Services", "Announcements")} />
        <ActionTile delay={410} label="Support" icon="chatbubbles-outline" tint={colors.graphite700} onPress={() => go(navigation, "Services", "Support")} />
      </View>

      <Text style={styles.footnote}>Attendance is marked by your Manager/Admin only. Salary updates live as attendance, advance and kharchi are posted.</Text>
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

/** Pulsing dot for the LIVE salary pill. */
export function PulseDot() {
  const s = useSharedValue(1);
  useEffect(() => { s.value = withRepeat(withTiming(0.35, { duration: 750 }), -1, true); }, [s]);
  const style = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: 0.8 + s.value * 0.35 }] }));
  return <Animated.View style={[styles.liveDotInner, style]} />;
}

function HeroStat({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.heroStatValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  greet: { fontSize: 17, fontWeight: "800", color: colors.graphite900 },
  date: { fontSize: 12, color: colors.graphite500, marginTop: 2 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow.soft },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md, backgroundColor: colors.amber50, borderColor: colors.amber },
  bannerRust: { backgroundColor: colors.rust50, borderColor: colors.rust },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: colors.graphite900 },
  bannerBody: { fontSize: 12, color: colors.graphite700, marginTop: 2 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroKicker: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  liveDot: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(42,156,143,0.22)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  liveDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.tealBright },
  liveText: { fontSize: 10, fontWeight: "800", color: colors.tealBright, letterSpacing: 0.8 },
  heroAmount: { fontSize: 38, fontWeight: "800", color: colors.white, marginTop: spacing.sm, fontVariant: ["tabular-nums"] },
  heroFormula: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4, marginBottom: spacing.sm },
  heroHint: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 6 },
  heroStats: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: spacing.md },
  heroStatValue: { fontSize: 14, fontWeight: "800", color: colors.white },
  heroStatLabel: { fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  tileRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  chartHint: { fontSize: 11, color: colors.graphite500, marginTop: 8, lineHeight: 15 },
  chartHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  chartTotalLabel: { fontSize: 10, fontWeight: "700", color: colors.graphite500, textTransform: "uppercase", letterSpacing: 0.5 },
  chartTotal: { fontSize: 19, fontWeight: "800", color: colors.graphite900, marginTop: 2, fontVariant: ["tabular-nums"] },
  chartChip: { backgroundColor: colors.teal50, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  chartChipText: { fontSize: 11, fontWeight: "800", color: colors.teal },
  noticePinned: { borderWidth: 1.5, borderColor: colors.amber },
  noticeTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.graphite900 },
  noticeBody: { fontSize: 12, color: colors.graphite500, marginTop: 6, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, rowGap: spacing.md },
  footnote: { fontSize: 11, color: colors.graphite300, textAlign: "center", marginTop: spacing.lg, lineHeight: 16 }
});
