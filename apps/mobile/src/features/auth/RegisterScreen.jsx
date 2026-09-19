import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Button } from "@/components/ui";
import { useRegisterStart, useVerifyRegistrationOtp, useLogin } from "./api";
import { colors, spacing, radius } from "@/theme";

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
export function RegisterScreen({ navigation }) {
  const [step, setStep] = useState("form");
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", password: "", confirmPassword: "" });
  const [otp, setOtp] = useState("");
  const [devOtpHint, setDevOtpHint] = useState(null);

  const registerStart = useRegisterStart();
  const verifyOtp = useVerifyRegistrationOtp();
  const login = useLogin();

  const submitForm = () => {
    if (form.password !== form.confirmPassword) {
      Alert.alert("Passwords don't match", "Please make sure both password fields match.");
      return;
    }
    registerStart.mutate(
      { fullName: form.fullName, phone: form.phone, address: form.address, password: form.password },
      {
        onSuccess: (data) => {
          setDevOtpHint(data.devOtp ?? null);
          setStep("otp");
        },
        onError: (err) => Alert.alert("Couldn't register", err instanceof Error ? err.message : "Unknown error"),
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
                Alert.alert(
                  "Verified, but couldn't sign in automatically",
                  (err instanceof Error ? err.message : "Unknown error") + " Please sign in manually."
                ),
              onSuccess: () => navigation.getParent()?.goBack?.(),
            }
          );
        },
        onError: (err) => Alert.alert("Incorrect code", err instanceof Error ? err.message : "Unknown error"),
      }
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {step === "form" ? (
          <View style={styles.form}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Rahul Kumar"
              placeholderTextColor={colors.graphite300}
              value={form.fullName}
              onChangeText={(v) => setForm({ ...form, fullName: v })}
            />

            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={styles.input}
              placeholder="9876543210"
              placeholderTextColor={colors.graphite300}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Village, District, State"
              placeholderTextColor={colors.graphite300}
              value={form.address}
              onChangeText={(v) => setForm({ ...form, address: v })}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="At least 8 characters, with a number"
              placeholderTextColor={colors.graphite300}
              secureTextEntry
              value={form.password}
              onChangeText={(v) => setForm({ ...form, password: v })}
            />

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.graphite300}
              secureTextEntry
              value={form.confirmPassword}
              onChangeText={(v) => setForm({ ...form, confirmPassword: v })}
            />

            <Button
              title={registerStart.isPending ? "Sending code…" : "Continue"}
              onPress={submitForm}
              variant="accent"
              disabled={!form.fullName || !form.phone || !form.address || !form.password || !form.confirmPassword}
              loading={registerStart.isPending}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Enter the 6-digit code sent to {form.phone}</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              placeholderTextColor={colors.graphite300}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />
            {devOtpHint && <Text style={styles.hint}>Dev mode — code: {devOtpHint}</Text>}

            <Button
              title={verifyOtp.isPending || login.isPending ? "Verifying…" : "Verify & continue"}
              onPress={submitOtp}
              variant="accent"
              disabled={otp.length !== 6}
              loading={verifyOtp.isPending || login.isPending}
            />
          </View>
        )}

        <Text style={styles.note}>
          After this, you'll pick your work type and upload your ID documents. Admin reviews and activates your
          account before you can be marked present at a site.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  form: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: 13, fontWeight: "600", color: colors.graphite900, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.graphite900,
  },
  hint: { fontSize: 12, color: colors.amber600, marginTop: -4 },
  note: { fontSize: 12, color: colors.graphite500, marginTop: spacing.lg, textAlign: "center" },
});
