import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { Button } from "@/components/ui";
import { useLogin } from "./api";
import { colors, spacing, radius, shadow, gradients, motion } from "@/theme";
import { BrandFooter } from "@/components/BrandFooter";
import { GlowSmallLogo } from "@/components/BrandLogo";
import { WebsiteButton } from "@/components/WebsiteButton";

/** Slowly drifting glow blob behind the login card. */
function GlowBlob({ style, size, color, drift = 26, duration = 5200, delay = 0 }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration, delay, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * drift }, { translateX: y.value * drift * 0.5 }] }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style, animated]} />;
}

function IconInput({ icon, focused, name, children }) {
  return (
    <View style={[styles.inputWrap, focused === name && styles.inputWrapFocused]}>
      <Ionicons name={icon} size={18} color={focused === name ? colors.amber600 : colors.graphite300} />
      {children}
    </View>
  );
}

export function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const login = useLogin();

  const isPhoneNotVerified = login.isError && login.error?.code === "PHONE_NOT_VERIFIED";

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <GlowBlob size={260} color="rgba(62,124,177,0.30)" drift={30} style={{ top: -80, right: -70 }} />
      <GlowBlob size={190} color="rgba(232,163,61,0.20)" drift={-22} duration={6400} delay={600} style={{ bottom: -50, left: -60 }} />
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "center" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ padding: spacing.xl }}>
          <Animated.View entering={FadeIn.duration(motion.slow)} style={styles.header}>
            <GlowSmallLogo size={86} />
            <Text style={styles.title}>Ananta Infratech</Text>
            <Text style={styles.subtitle}>Workforce & Project Management</Text>
            <View style={styles.trustRow}>
              {[["calendar-outline", "Attendance"], ["wallet-outline", "Salary"], ["business-outline", "Sites"]].map(([icon, x]) => (
                <View key={x} style={styles.trustChip}>
                  <Ionicons name={icon} size={12} color={colors.gold} />
                  <Text style={styles.trustText}>{x}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(motion.slow).springify().damping(18)} style={styles.form}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSub}>Sign in to see today's pay, attendance & more.</Text>

            <Text style={styles.label}>Mobile number</Text>
            <IconInput icon="call-outline" name="phone" focused={focused}>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor={colors.graphite300}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setFocused("phone")}
                onBlur={() => setFocused(null)}
              />
            </IconInput>

            <Text style={styles.label}>Password</Text>
            <IconInput icon="lock-closed-outline" name="password" focused={focused}>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.graphite300}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityLabel={showPassword ? "Hide password" : "Show password"} hitSlop={8}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={19} color={colors.graphite500} />
              </Pressable>
            </IconInput>

            {login.isError && <Text style={styles.error}>{login.error.message || "Login failed."}</Text>}
            {isPhoneNotVerified && (
              <Pressable onPress={() => navigation.navigate("Register")}>
                <Text style={styles.resendLink}>Finish verifying your number →</Text>
              </Pressable>
            )}

            <View style={{ marginTop: spacing.md }}>
              <Button
                title={login.isPending ? "Signing in…" : "Sign in →"}
                onPress={() => login.mutate({ phone, password })}
                variant="accent"
                disabled={!phone || !password}
                loading={login.isPending}
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(300).duration(motion.slow)}>
            <Text style={styles.footerNote}>Attendance is marked by your Manager/Admin.{"\n"}Your salary, advances & kharchi update live.</Text>
            <WebsiteButton style={{ marginTop: spacing.lg, marginHorizontal: spacing.xl }} />
            <Pressable style={styles.registerRow} onPress={() => navigation.navigate("Register")}>
              <Text style={styles.registerText}>
                New worker? <Text style={styles.registerLink}>Register →</Text>
              </Text>
            </Pressable>
            <BrandFooter dark showMark={false} />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", marginBottom: spacing.xl },
  title: { fontSize: 23, fontWeight: "800", color: colors.white, letterSpacing: -0.3, marginTop: spacing.sm },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4, fontWeight: "600" },
  form: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow.lifted },
  formTitle: { fontSize: 17, fontWeight: "800", color: colors.graphite900 },
  formSub: { fontSize: 12, color: colors.graphite500, marginTop: 3, marginBottom: spacing.xs },
  label: { fontSize: 13, fontWeight: "600", color: colors.graphite900, marginTop: spacing.md, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1.5,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  inputWrapFocused: { borderColor: colors.amber, backgroundColor: colors.amber50 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.graphite900 },
  error: { color: colors.rust, fontSize: 13, marginTop: spacing.sm },
  resendLink: { color: colors.amber600, fontSize: 13, fontWeight: "600", marginTop: 2 },
  registerRow: { marginTop: spacing.lg, alignItems: "center" },
  registerText: { color: "rgba(255,255,255,0.6)", fontSize: 14 },
  registerLink: { color: colors.gold, fontWeight: "700" },
  trustRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  trustChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  trustText: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600" },
  footerNote: { color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center", marginTop: spacing.lg, lineHeight: 16 },
});
