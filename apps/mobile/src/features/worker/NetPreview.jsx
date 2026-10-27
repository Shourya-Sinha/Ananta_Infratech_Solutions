import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Ionicons from "react-native-vector-icons/Ionicons";
import { CountUp, formatINR } from "@/components/interactive";
import { colors, spacing, radius } from "@/theme";

/**
 * Live "what would this do to my pay" preview shown while a worker types an
 * advance or kharchi amount. The deduction itself posts only when approved and
 * paid, so this is labelled as a projection.
 */
export function NetPreview({ currentNet, amountRupees, kind }) {
  const amount = Number(amountRupees) || 0;
  if (!amount || currentNet === undefined || currentNet === null) return null;
  const projected = currentNet - amount;
  const short = projected < 0;
  return (
    <Animated.View entering={FadeIn.duration(180)} style={[styles.box, short && styles.boxWarn]}>
      <View style={styles.head}>
        <Ionicons name={short ? "warning-outline" : "analytics-outline"} size={14} color={short ? colors.rust : colors.teal} />
        <Text style={[styles.title, short && { color: colors.rust }]}>If this {kind} is approved and paid</Text>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Net this month now</Text>
          <Text style={styles.now}>{formatINR(currentNet)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.graphite300} />
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.label}>Net after</Text>
          <CountUp value={projected} duration={300} style={[styles.after, short && { color: colors.rust }]} />
        </View>
      </View>
      {short && <Text style={styles.warn}>This is more than your earnings so far this month.</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.teal50, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, gap: 8 },
  boxWarn: { backgroundColor: colors.rust50 },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 12, fontWeight: "700", color: colors.teal },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  label: { fontSize: 11, color: colors.graphite500 },
  now: { fontSize: 15, fontWeight: "700", color: colors.graphite900, marginTop: 2, fontVariant: ["tabular-nums"] },
  after: { fontSize: 15, fontWeight: "800", color: colors.teal, marginTop: 2, fontVariant: ["tabular-nums"] },
  warn: { fontSize: 11, color: colors.rust }
});
