import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Button } from "@/components/ui";
import { useLogin } from "./api";
import { colors, spacing, radius, shadow, gradients, motion } from "@/theme";

export function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const isPhoneNotVerified = login.isError && login.error?.code === "PHONE_NOT_VERIFIED";

  return (
    <LinearGradient colors={gradients.night} style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "center" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ padding: spacing.xl }}>
          <Animated.View entering={FadeIn.duration(motion.slow)} style={styles.header}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>A</Text>
            </View>
            <Text style={styles.title}>Ananta Infratech</Text>
            <Text style={styles.subtitle}>Workforce & Project Management</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(motion.slow).springify().damping(18)} style={styles.form}>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={styles.input}
              placeholder="9876543210"
              placeholderTextColor={colors.graphite300}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.graphite300}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {login.isError && <Text style={styles.error}>{login.error.message || "Login failed."}</Text>}
            {isPhoneNotVerified && (
              <Pressable onPress={() => navigation.navigate("Register")}>
                <Text style={styles.resendLink}>Finish verifying your number →</Text>
              </Pressable>
            )}

            <View style={{ marginTop: spacing.xs }}>
              <Button
                title={login.isPending ? "Signing in…" : "Sign in"}
                onPress={() => login.mutate({ phone, password })}
                variant="accent"
                disabled={!phone || !password}
                loading={login.isPending}
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(300).duration(motion.slow)}>
            <Pressable style={styles.registerRow} onPress={() => navigation.navigate("Register")}>
              <Text style={styles.registerText}>
                New worker? <Text style={styles.registerLink}>Register</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", marginBottom: spacing.xxl },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    ...shadow.lifted,
  },
  logoMarkText: { fontSize: 26, fontWeight: "800", color: colors.white },
  title: { fontSize: 21, fontWeight: "800", color: colors.white, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: colors.graphite300, marginTop: 4 },
  form: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow.lifted },
  label: { fontSize: 13, fontWeight: "600", color: colors.graphite900, marginTop: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.graphite900,
  },
  error: { color: colors.rust, fontSize: 13, marginTop: spacing.xs },
  resendLink: { color: colors.amber600, fontSize: 13, fontWeight: "600", marginTop: 2 },
  registerRow: { marginTop: spacing.xl, alignItems: "center" },
  registerText: { color: colors.graphite300, fontSize: 14 },
  registerLink: { color: colors.white, fontWeight: "700" },
});
