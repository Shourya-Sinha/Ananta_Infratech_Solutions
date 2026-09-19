import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { colors, radius, spacing, shadow, motion, gradients } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ title, onPress, variant = "primary", disabled, loading }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, motion.springy);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, motion.springy);
  };
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isGradient = variant === "accent";
  const bg =
    variant === "primary" ? colors.graphite900 : variant === "danger" ? colors.rust : colors.surface;
  const textColor = variant === "ghost" ? colors.graphite900 : colors.white;

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
  );

  if (isGradient) {
    return (
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        style={[animatedStyle, { opacity: disabled ? 0.5 : 1 }]}
      >
        <LinearGradient colors={gradients.amber} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.button,
        animatedStyle,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === "ghost" && styles.buttonGhostBorder,
      ]}
    >
      {content}
    </AnimatedPressable>
  );
}

export function Card({ children, style, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(motion.base).springify().damping(18)} style={[styles.card, style]}>
      {children}
    </Animated.View>
  );
}

export function Badge({ label, tone = "neutral" }) {
  const bg = tone === "positive" ? colors.teal50 : tone === "negative" ? colors.rust50 : tone === "amber" ? colors.amber50 : colors.steel100;
  const fg = tone === "positive" ? colors.teal : tone === "negative" ? colors.rust : tone === "amber" ? colors.amber600 : colors.graphite500;

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (tone === "amber") {
      pulse.value = withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs, safe to omit.
  }, [tone]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: tone === "amber" ? pulse.value : 1 }));

  return (
    <Animated.View style={[styles.badge, { backgroundColor: bg }, pulseStyle]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </Animated.View>
  );
}

export function EmptyState({ title, body }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.slow)} style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </Animated.View>
  );
}

export function ScreenHeader({ title, subtitle }) {
  return (
    <Animated.View entering={FadeInDown.duration(motion.base)} style={{ marginBottom: spacing.lg }}>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle && <Text style={styles.screenSubtitle}>{subtitle}</Text>}
    </Animated.View>
  );
}

export function Skeleton({ width = "100%", height = 16, style }) {
  const shimmer = useSharedValue(0.4);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs, safe to omit.
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius.sm, backgroundColor: colors.steel100 }, animatedStyle, style]} />;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonGhostBorder: { borderWidth: 1, borderColor: colors.steel200 },
  buttonText: { fontSize: 15, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 56, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.graphite900 },
  emptyBody: { fontSize: 13, color: colors.graphite500, textAlign: "center", maxWidth: 260 },
  screenTitle: { fontSize: 24, fontWeight: "800", color: colors.graphite900, letterSpacing: -0.3 },
  screenSubtitle: { fontSize: 13, color: colors.graphite500, marginTop: 3 },
});
