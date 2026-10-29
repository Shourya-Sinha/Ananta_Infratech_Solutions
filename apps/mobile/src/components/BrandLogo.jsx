import { View, Image, StyleSheet } from "react-native";
import { colors, radius, shadow } from "@/theme";

// Brand assets (source originals live at the repo root: small_logo.png /
// wide_logo.png; launcher icons are generated from small_logo.png).
const smallLogo = require("@/assets/small_logo.png");
const wideLogo = require("@/assets/wide_logo.png");

/** Compact logo mark (crane + infinity "A") for footers, chips, headers. */
export function SmallLogo({ size = 26, style }) {
  return (
    <View style={[styles.smallWrap, { width: size, height: size, borderRadius: size * 0.28 }, style]}>
      <Image source={smallLogo} style={{ width: size * 0.92, height: size * 0.92 }} resizeMode="contain" accessibilityLabel="Ananta Infratech Solutions logo" />
    </View>
  );
}

/**
 * Full wide lockup (mark + ANANTA INFRATECH SOLUTIONS) on a white card —
 * the artwork has dark text, so it always sits on white for contrast.
 */
export function WideLogo({ width = 240, style }) {
  const height = width * (141 / 360);
  return (
    <View style={[styles.wideWrap, style]}>
      <Image source={wideLogo} style={{ width, height }} resizeMode="contain" accessibilityLabel="Ananta Infratech Solutions" />
    </View>
  );
}

const styles = StyleSheet.create({
  smallWrap: { backgroundColor: colors.white, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  wideWrap: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    ...shadow.lifted,
  },
});
