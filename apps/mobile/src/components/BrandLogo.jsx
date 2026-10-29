import { View, Image, StyleSheet } from "react-native";
import { useEffect } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
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
 * Small logo with a soft breathing glow — used at the top of the Login /
 * Register pages. Two gold/teal halos pulse behind the white logo tile
 * while the tile gently floats, so the mark feels alive without moving
 * the layout around.
 */
export function GlowSmallLogo({ size = 88 }) {
  const pulse = useSharedValue(0);
  const float = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
    float.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse, float]);
  const haloGold = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.22 }],
  }));
  const haloTeal = useAnimatedStyle(() => ({
    opacity: 0.5 - pulse.value * 0.3,
    transform: [{ scale: 1.18 - pulse.value * 0.14 }],
  }));
  const tile = useAnimatedStyle(() => ({ transform: [{ translateY: -float.value * 4 }] }));
  return (
    <View style={{ width: size * 1.5, height: size * 1.5, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Ananta Infratech Solutions logo">
      <Animated.View style={[styles.halo, { width: size * 1.28, height: size * 1.28, borderRadius: size * 0.4, backgroundColor: "rgba(232,163,61,0.5)" }, haloGold]} />
      <Animated.View style={[styles.halo, { width: size * 1.12, height: size * 1.12, borderRadius: size * 0.36, backgroundColor: "rgba(42,156,143,0.45)" }, haloTeal]} />
      <Animated.View style={[styles.glowTile, { width: size, height: size, borderRadius: size * 0.27 }, tile]}>
        <Image source={smallLogo} style={{ width: size * 0.94, height: size * 0.94 }} resizeMode="contain" />
      </Animated.View>
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
  halo: { position: "absolute" },
  glowTile: { backgroundColor: colors.white, alignItems: "center", justifyContent: "center", overflow: "hidden", ...shadow.lifted },
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
