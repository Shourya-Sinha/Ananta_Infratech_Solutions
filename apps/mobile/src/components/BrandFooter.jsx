import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme";

/**
 * Company credit line shown at the bottom of key screens (salary,
 * documents, settings/profile, login) and reusable anywhere else:
 * "Developed & maintained by Shourya — Ananta Infratech Solutions".
 */
export function BrandFooter({ dark = false, style }) {
  const main = dark ? "rgba(255,255,255,0.85)" : colors.graphite700;
  const sub = dark ? "rgba(255,255,255,0.5)" : colors.graphite300;
  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Developed and maintained by Shourya, Ananta Infratech Solutions">
      <View style={styles.mark}>
        <Ionicons name="construct-outline" size={13} color={colors.gold} />
      </View>
      <Text style={[styles.main, { color: main }]}>
        Developed &amp; maintained by <Text style={styles.name}>Shourya</Text>
      </Text>
      <Text style={[styles.sub, { color: sub }]}>Ananta Infratech Solutions</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 2, marginTop: spacing.xl, paddingBottom: spacing.sm },
  mark: {
    width: 26, height: 26, borderRadius: 13, marginBottom: 4,
    backgroundColor: colors.navy, alignItems: "center", justifyContent: "center"
  },
  main: { fontSize: 12, fontWeight: "600" },
  name: { fontWeight: "800", color: colors.amber },
  sub: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" }
});
