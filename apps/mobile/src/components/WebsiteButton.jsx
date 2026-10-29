import { Text, StyleSheet, Linking } from "react-native";
import { toast } from "@/components/Toast";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import { PressScale } from "@/components/interactive";
import { colors, spacing, radius, gradients } from "@/theme";

/** Company website — workers and managers can open it from the app. */
export const WEBSITE_URL = "https://anantainfratechsolutions.com";

export function openWebsite() {
  Linking.openURL(WEBSITE_URL).catch(() =>
    toast.error("Couldn't open website", `Please visit ${WEBSITE_URL} in your browser.`)
  );
}

/** Prominent gradient pill: globe + "Visit our website". */
export function WebsiteButton({ style }) {
  return (
    <PressScale onPress={openWebsite} accessibilityLabel="Visit our website, anantainfratechsolutions.com" style={style}>
      <LinearGradient colors={gradients.teal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
        <Ionicons name="globe-outline" size={17} color={colors.white} />
        <Text style={styles.text}>Visit our website</Text>
        <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.8)" />
      </LinearGradient>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  text: { color: colors.white, fontSize: 13.5, fontWeight: "800" },
});
