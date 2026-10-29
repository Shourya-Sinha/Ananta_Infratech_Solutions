import { useState, useEffect } from "react";
import { toast } from "@/components/Toast";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { Button } from "@/components/ui";
import { BrandFooter } from "@/components/BrandFooter";
import { GlowSmallLogo } from "@/components/BrandLogo";
import { WebsiteButton } from "@/components/WebsiteButton";
import { useRegisterStart, useVerifyRegistrationOtp, useLogin } from "./api";
import { colors, spacing, radius, shadow, gradients } from "@/theme";

/**
 * Self-registration, done by the worker themselves on their own phone
 * (spec §7 Steps 1 + 3 — basic info, then OTP verification; work type
 * selection happens right after on the Worker Home screen once logged in,
 * since it needs an authenticated WORKER account per the backend's
 * record-level-scope rule — see SelectWorkTypeScreen).
 *
 * Two-step flow in one screen: form -> OTP. Nothing sensitive is passed
 * via navigation params; the password stays in this component's state
 * only as long as needed to auto-login right after OTP verification.
 */
function GlowBlob({ style, size, color, drift = 24, duration = 5600, delay = 0 }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration, delay, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * drift }] }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style, animated]} />;
}

function StepDots({ step }) {
  const steps = ["Your details", "Verify OTP"];
  return (
    <View style={styles.steps}>
      {steps.map((label, i) => {
        const active = (step === "form" ? 0 : 1) === i;
        const done = (step === "form" ? 0 : 1) > i;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, (active || done) && styles.stepDotActive]}>
              {done ? <Ionicons name="checkmark" size={13} color={colors.white} /> : <Text style={[styles.stepNum, active && { color: colors.white }]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            {i === 0 && <View style={[styles.stepLine, step !== "form" && styles.stepLineActive]} />}
          </View>
        );
      })}
    </View>
  );
}

export function RegisterScreen({ navigation }) {
  const [step, setStep] = useState("form");
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", password: "", confirmPassword: "" });
  const [otp, setOtp] = useState("");
  const [devOtpHint, setDevOtpHint] = useState(null);
  const [focused, setFocused] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const registerStart = useRegisterStart();
  const verifyOtp = useVerifyRegistrationOtp();
  const login = useLogin();

  const submitForm = () => {
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords don't match", "Please make sure both password fields match.");
      return;
    }
    registerStart.mutate(
      { fullName: form.fullName, phone: form.phone, address: form.address, password: form.password },
      {
        onSuccess: (data) => {
          setDevOtpHint(data.devOtp ?? null);
          setStep("otp");
          toast.success("Code sent", `Enter the 6-digit code sent to ${form.phone}.`);
        },
        onError: (err) => toast.error("Couldn't register", err instanceof Error ? err.message : "Unknown error"),
      }
    );
  };

  const submitOtp = () => {
    verifyOtp.mutate(
      { phone: form.phone, otp },
      {
        onSuccess: () => {
          // Auto-login right after verification so the person doesn't have
          // to re-type their phone/password a second time.
          login.mutate(
            { phone: form.phone, password: form.password },
            {
              onError: (err) =>
                toast.error(
                  "Verified, but couldn't sign in automatically",
                  (err instanceof Error ? err.message : "Unknown error") + " Please sign in manually."
                ),
              onSuccess: () => navigation.getParent()?.goBack?.(),
            }
          );
        },
        onError: (err) => toast.error("Incorrect code", err instanceof Error ? err.message : "Unknown error"),
      }
    );
  };

  const field = (label, icon, props) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused === label && styles.inputWrapFocused]}>
        <Ionicons name={icon} size={18} color={focused === label ? colors.amber600 : colors.graphite300} />
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.graphite300}
          onFocus={() => setFocused(label)}
          onBlur={() => setFocused(null)}
          {...props}
        />
      </View>
    </>
  );

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <GlowBlob size={230} color="rgba(62,124,177,0.28)" style={{ top: -70, right: -60 }} />
      <GlowBlob size={170} color="rgba(232,163,61,0.18)" drift={-20} delay={500} style={{ bottom: -40, left: -50 }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
            <GlowSmallLogo size={78} />
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Register once — then track salary, attendance & documents in the app.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(350)}>
            <StepDots step={step} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).duration(350).springify().damping(19)} style={styles.form}>
            {step === "form" ? (
              <>
                {field("Full name", "person-outline", {
                  placeholder: "Rahul Kumar",
                  value: form.fullName,
                  onChangeText: (v) => setForm({ ...form, fullName: v }),
                })}
                {field("Mobile number", "call-outline", {
                  placeholder: "9876543210",
                  keyboardType: "phone-pad",
                  value: form.phone,
                  onChangeText: (v) => setForm({ ...form, phone: v }),
                })}
                {field("Address", "location-outline", {
                  placeholder: "Village, District, State",
                  value: form.address,
                  onChangeText: (v) => setForm({ ...form, address: v }),
                })}
                <Text style={styles.label}>Password</Text>
                <View style={[styles.inputWrap, focused === "Password" && styles.inputWrapFocused]}>
                  <Ionicons name="lock-closed-outline" size={18} color={focused === "Password" ? colors.amber600 : colors.graphite300} />
                  <TextInput
                    style={styles.input}
                    placeholder="At least 8 characters, with a number"
                    placeholderTextColor={colors.graphite300}
                    secureTextEntry={!showPassword}
                    value={form.password}
                    onChangeText={(v) => setForm({ ...form, password: v })}
                    onFocus={() => setFocused("Password")}
                    onBlur={() => setFocused(null)}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityLabel={showPassword ? "Hide password" : "Show password"} hitSlop={8}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={19} color={colors.graphite500} />
                  </Pressable>
                </View>
                {field("Confirm password", "shield-checkmark-outline", {
                  placeholder: "••••••••",
                  secureTextEntry: true,
                  value: form.confirmPassword,
                  onChangeText: (v) => setForm({ ...form, confirmPassword: v }),
                })}

                <View style={{ marginTop: spacing.lg }}>
                  <Button
                    title={registerStart.isPending ? "Sending code…" : "Continue →"}
                    onPress={submitForm}
                    variant="accent"
                    disabled={!form.fullName || !form.phone || !form.address || !form.password || !form.confirmPassword}
                    loading={registerStart.isPending}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.otpIcon}>
                  <Ionicons name="chatbubbles-outline" size={26} color={colors.teal} />
                </View>
                <Text style={styles.otpTitle}>Enter the 6-digit code</Text>
                <Text style={styles.otpSub}>Sent to +91 {form.phone}</Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="••••••"
                  placeholderTextColor={colors.graphite300}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  autoFocus
                />
                {devOtpHint && <Text style={styles.hint}>Dev mode — code: {devOtpHint}</Text>}

                <View style={{ marginTop: spacing.lg }}>
                  <Button
                    title={verifyOtp.isPending || login.isPending ? "Verifying…" : "Verify & continue →"}
                    onPress={submitOtp}
                    variant="accent"
                    disabled={otp.length !== 6}
                    loading={verifyOtp.isPending || login.isPending}
                  />
                </View>
                <Pressable onPress={() => setStep("form")} style={{ marginTop: spacing.md, alignItems: "center" }}>
                  <Text style={styles.backLink}>← Wrong number? Edit details</Text>
                </Pressable>
              </>
            )}
          </Animated.View>

          <Animated.View entering={FadeIn.delay(260).duration(350)}>
            <Text style={styles.note}>
              After this, you'll pick your work type and upload your ID documents. Admin reviews and activates your
              account before you can be marked present at a site.
            </Text>
            <WebsiteButton style={{ marginTop: spacing.lg, marginHorizontal: spacing.xl }} />
            <Pressable onPress={() => navigation.goBack()} style={{ alignItems: "center", marginTop: spacing.sm }}>
              <Text style={styles.loginLink}>Already registered? <Text style={{ color: colors.gold, fontWeight: "700" }}>Sign in →</Text></Text>
            </Pressable>
            <BrandFooter dark showMark={false} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", marginBottom: spacing.lg },
  title: { fontSize: 23, fontWeight: "800", color: colors.white, letterSpacing: -0.3, marginTop: spacing.lg },
  subtitle: { fontSize: 12.5, color: "rgba(255,255,255,0.6)", marginTop: 5, textAlign: "center", lineHeight: 17, paddingHorizontal: spacing.md },
  steps: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", marginBottom: spacing.lg },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  stepDotActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  stepNum: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.7)" },
  stepLabel: { fontSize: 11.5, fontWeight: "600", color: "rgba(255,255,255,0.55)" },
  stepLabelActive: { color: colors.white },
  stepLine: { width: 34, height: 1.5, backgroundColor: "rgba(255,255,255,0.25)", marginHorizontal: 8 },
  stepLineActive: { backgroundColor: colors.amber },
  form: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow.lifted },
  label: { fontSize: 13, fontWeight: "600", color: colors.graphite900, marginTop: spacing.md, marginBottom: 6 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1.5, borderColor: colors.steel200, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  inputWrapFocused: { borderColor: colors.amber, backgroundColor: colors.amber50 },
  input: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.graphite900 },
  otpIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.teal50, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.sm },
  otpTitle: { fontSize: 16, fontWeight: "800", color: colors.graphite900, textAlign: "center" },
  otpSub: { fontSize: 12, color: colors.graphite500, textAlign: "center", marginTop: 3, marginBottom: spacing.md },
  otpInput: { borderWidth: 1.5, borderColor: colors.amber, backgroundColor: colors.amber50, borderRadius: radius.md, paddingVertical: 13, fontSize: 22, fontWeight: "800", letterSpacing: 8, textAlign: "center", color: colors.graphite900 },
  hint: { fontSize: 12, color: colors.amber600, marginTop: spacing.sm, textAlign: "center", fontWeight: "700" },
  backLink: { fontSize: 13, fontWeight: "600", color: colors.amber600 },
  note: { fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: spacing.lg, textAlign: "center", lineHeight: 16 },
  loginLink: { color: "rgba(255,255,255,0.65)", fontSize: 13.5 },
});
