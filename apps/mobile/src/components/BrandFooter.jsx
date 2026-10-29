import { View, Text, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { colors, spacing } from "@/theme";
import { SmallLogo } from "@/components/BrandLogo";
import { openWebsite } from "@/components/WebsiteButton";
import { PressScale } from "@/components/interactive";

/**
 * Company credit line shown at the bottom of key screens (salary,
 * documents, settings/profile, login) and reusable anywhere else:
 * "Developed & maintained by Shourya — Ananta Infratech Solutions".
 */
export function BrandFooter({ dark = false, style, showMark = true }) {
  const main = dark ? "rgba(255,255,255,0.85)" : colors.graphite700;
  const sub = dark ? "rgba(255,255,255,0.5)" : colors.graphite300;
  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Developed and maintained by Shourya, Ananta Infratech Solutions">
      {showMark && <SmallLogo size={30} style={{ marginBottom: 4 }} />}
      <Text style={[styles.main, { color: main }]}>
        Developed &amp; maintained by <Text style={styles.name}>Shourya</Text>
      </Text>
      <Text style={[styles.sub, { color: sub }]}>Ananta Infratech Solutions</Text>
      <PressScale onPress={openWebsite} haptic accessibilityLabel="Visit our website, anantainfratechsolutions.com" style={styles.webRow}>
        <Ionicons name="globe-outline" size={12} color={colors.teal} />
        <Text style={styles.webText}>Visit our website</Text>
        <Ionicons name="open-outline" size={10} color={colors.teal} />
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 2, marginTop: spacing.xl, paddingBottom: spacing.sm },
  webRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7, paddingVertical: 4, paddingHorizontal: 8 },
  webText: { fontSize: 11.5, fontWeight: "800", color: colors.teal, textDecorationLine: "underline" },
  main: { fontSize: 12, fontWeight: "600" },
  name: { fontWeight: "800", color: colors.amber },
  sub: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" }
});
