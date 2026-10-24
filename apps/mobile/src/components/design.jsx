import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from "react-native-reanimated";
import { useEffect } from "react";
import { PressScale } from "./interactive";
import { colors, spacing, radius, shadow, gradients } from "@/theme";

/** Initials avatar with a deterministic brand gradient. */
export function Avatar({ name = "?", size = 44 }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const palettes = [gradients.gold, gradients.teal, ["#5B8DEF", "#3E7CB1"], ["#9B7EDE", "#6C5CE7"], ["#E2703A", "#B84A3E"]];
  const idx = (name.charCodeAt(0) || 0) % palettes.length;
  return (
    <LinearGradient colors={palettes[idx]} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.white, fontWeight: "800", fontSize: size * 0.36 }}>{initials}</Text>
    </LinearGradient>
  );
}

/** Dark gradient hero panel used at the top of home screens. */
export function GradientHero({ children, style }) {
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, style]}>
      <View style={styles.heroBlobA} />
      <View style={styles.heroBlobB} />
      {children}
    </LinearGradient>
  );
}

export function StatTile({ label, value, sub, icon, tint = colors.teal, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(320).springify().damping(18)} style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {!!sub && <Text style={styles.tileSub}>{sub}</Text>}
    </Animated.View>
  );
}

export function ActionTile({ label, icon, tint = colors.amber, onPress, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={{ width: "25%", paddingHorizontal: 4 }}>
      <PressScale onPress={onPress} accessibilityLabel={label} style={[styles.action, shadow.soft]}>
        <View style={[styles.actionIcon, { backgroundColor: `${tint}1A` }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
      </PressScale>
    </Animated.View>
  );
}

export function SectionTitle({ children, actionLabel, onAction }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {!!actionLabel && (
        <PressScale onPress={onAction} haptic={false}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </PressScale>
      )}
    </View>
  );
}

export function MenuRow({ icon, tint = colors.graphite700, label, sub, onPress, chevron = true, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(260)}>
      <PressScale onPress={onPress} style={styles.menuRow}>
        <View style={[styles.menuIcon, { backgroundColor: `${tint}1A` }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuLabel}>{label}</Text>
          {!!sub && <Text style={styles.menuSub}>{sub}</Text>}
        </View>
        {chevron && <Ionicons name="chevron-forward" size={16} color={colors.graphite300} />}
      </PressScale>
    </Animated.View>
  );
}

/** Animated vertical bars for a daily series (e.g. last days of earnings). */
export function EarningsBars({ data = [], height = 84, color = colors.tealBright, emptyLabel = "No earnings yet" }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value ?? 0)));
  if (!data.length) return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  return (
    <View style={[styles.bars, { height }]}>
      {data.map((d, i) => (
        <Bar key={d.label ?? i} fraction={Math.abs(d.value ?? 0) / max} label={d.label} height={height} color={d.value < 0 ? colors.rust : color} index={i} />
      ))}
    </View>
  );
}

function Bar({ fraction, label, color, index }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(index * 45, withTiming(Math.max(0.04, fraction), { duration: 550, easing: Easing.out(Easing.cubic) }));
  }, [fraction, h, index]);
  const style = useAnimatedStyle(() => ({ height: `${h.value * 78}%` }));
  return (
    <View style={styles.barCol}>
      <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
      {!!label && <Text style={styles.barLabel}>{label}</Text>}
    </View>
  );
}

const STATUS_STYLE = {
  PRESENT: { bg: colors.teal, label: "P" },
  HALF_DAY: { bg: colors.sky, label: "½" },
  LEAVE_PAID: { bg: colors.violet, label: "L" },
  LEAVE_UNPAID: { bg: colors.graphite300, label: "L" },
  ABSENT: { bg: colors.rust, label: "A" },
  CUSTOM: { bg: colors.amber, label: "•" },
  HOLIDAY: { bg: colors.gold, label: "H" }
};

/**
 * Month calendar. days: { 'YYYY-MM-DD': status }, holidays: Set of date keys.
 * Renders a Mon-first grid; today is ringed, selected day is filled dark.
 */
export function MonthCalendar({ year, month, days = {}, holidays = new Set(), selected, onSelect }) {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const todayKey = new Date().toISOString().slice(0, 10);
  const keyFor = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return (
    <View>
      <View style={styles.calRow}>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <Text key={d} style={styles.calHead}>{d}</Text>
        ))}
      </View>
      {chunk(cells, 7).map((week, wi) => (
        <View key={wi} style={styles.calRow}>
          {week.map((d, di) => {
            if (!d) return <View key={di} style={styles.calCell} />;
            const key = keyFor(d);
            const status = holidays.has(key) ? "HOLIDAY" : days[key];
            const s = STATUS_STYLE[status];
            const isToday = key === todayKey;
            const isSel = key === selected;
            return (
              <PressScale key={di} haptic={false} onPress={() => onSelect?.(key)} style={[styles.calCell, isSel && styles.calCellSel, isToday && !isSel && styles.calCellToday]}>
                <Text style={[styles.calDay, isSel && { color: colors.white }, s && !isSel && { color: s.bg, fontWeight: "800" }]}>{d}</Text>
                {!!s && <View style={[styles.calDot, { backgroundColor: isSel ? colors.white : s.bg }]} />}
              </PressScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: radius.xl, padding: spacing.xl, overflow: "hidden", ...shadow.lifted },
  heroBlobA: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(62,124,177,0.25)", top: -70, right: -40 },
  heroBlobB: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(232,163,61,0.16)", bottom: -50, left: -20 },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.soft },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  tileValue: { fontSize: 16, fontWeight: "800", color: colors.graphite900 },
  tileLabel: { fontSize: 11, color: colors.graphite500, marginTop: 2 },
  tileSub: { fontSize: 10, color: colors.graphite300, marginTop: 1 },
  action: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", gap: 6 },
  actionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, fontWeight: "600", color: colors.graphite900, textAlign: "center" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: colors.graphite500, textTransform: "uppercase", letterSpacing: 0.6 },
  sectionAction: { fontSize: 12, fontWeight: "700", color: colors.amber600 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.soft },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 14, fontWeight: "700", color: colors.graphite900 },
  menuSub: { fontSize: 11, color: colors.graphite500, marginTop: 1 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 },
  bar: { width: "72%", borderRadius: 5, minHeight: 3 },
  barLabel: { fontSize: 9, color: colors.graphite300 },
  emptyText: { fontSize: 12, color: colors.graphite300, textAlign: "center", paddingVertical: spacing.md },
  calRow: { flexDirection: "row" },
  calHead: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", color: colors.graphite300, paddingVertical: 4 },
  calCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, margin: 1 },
  calCellSel: { backgroundColor: colors.navy },
  calCellToday: { borderWidth: 1.5, borderColor: colors.amber },
  calDay: { fontSize: 12, color: colors.graphite700, fontVariant: ["tabular-nums"] },
  calDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 }
});
