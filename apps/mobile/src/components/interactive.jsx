import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, radius } from "@/theme";

export function formatINR(n, { sign = false } = {}) {
  const abs = Math.abs(n ?? 0);
  const body = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(abs);
  if (!sign) return (n ?? 0) < 0 ? `−${body}` : body;
  return `${(n ?? 0) < 0 ? "−" : "+"}${body}`;
}

/** Springy press feedback plus a light haptic tick. */
export function PressScale({ onPress, style, children, disabled, haptic = true, accessibilityLabel }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      onPress={() => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
    >
      <Animated.View style={[style, animated, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Counts from the previous value to the new one; used for the hero pay figure. */
export function CountUp({ value, duration = 700, format = formatINR, style }) {
  const [display, setDisplay] = useState(value ?? 0);
  const fromRef = useRef(value ?? 0);
  useEffect(() => {
    const from = fromRef.current;
    const to = value ?? 0;
    const start = Date.now();
    let frame;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) frame = setTimeout(tick, 16);
      else fromRef.current = to;
    };
    tick();
    return () => clearTimeout(frame);
  }, [value, duration]);
  return <Text style={style}>{format(display)}</Text>;
}

/** Animated horizontal bar, 0–100. */
export function ProgressBar({ percent, color = colors.teal, track = "rgba(255,255,255,0.15)", height = 8 }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(100, percent ?? 0)), { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [percent, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={[styles.track, { backgroundColor: track, height }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, height }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: "hidden", width: "100%" },
  fill: { borderRadius: radius.pill }
});
