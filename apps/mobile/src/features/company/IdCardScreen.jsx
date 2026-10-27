import { View, Text, StyleSheet } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ScreenHeader } from "@/components/ui";
import { Avatar } from "@/components/design";
import { useMyProfile } from "@/features/worker/api";
import { useAuthStore } from "@/stores/authStore";
import { colors, spacing, radius, gradients } from "@/theme";

/** Digital worker ID card — show at the site gate. Data from the worker profile. */
export function IdCardScreen() {
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useMyProfile();

  return (
    <View style={styles.container}>
      <ScreenHeader title="My ID Card" subtitle="Show this at your site gate" />
      <Animated.View entering={FadeInDown.duration(420).springify().damping(16)}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={styles.blobA} />
          <View style={styles.topRow}>
            <View style={styles.logo}><Text style={styles.logoText}>A</Text></View>
            <View>
              <Text style={styles.company}>ANANTA INFRATECH</Text>
              <Text style={styles.companySub}>SOLUTIONS · WORKFORCE ID</Text>
            </View>
            <Ionicons name="shield-checkmark" size={22} color={colors.gold} style={{ marginLeft: "auto" }} />
          </View>

          <View style={styles.personRow}>
            <Avatar name={user?.name ?? "?"} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user?.name ?? "—"}</Text>
              <Text style={styles.role}>{profile?.workType?.name ?? "Worker"} · {profile?.employeeId ?? "—"}</Text>
            </View>
          </View>

          <View style={styles.grid}>
            <Field label="Site" value={profile?.currentSite?.name ?? "Not assigned"} />
            <Field label="Status" value={profile?.verificationStatus ?? "—"} />
            <Field label="Phone" value={user?.phone ?? "—"} />
            <Field label="Emergency" value={profile?.emergencyContact?.phone ?? "—"} />
          </View>

          {/* Decorative barcode-style strip (visual ID, not a scannable code) */}
          <View style={styles.barcode}>
            {Array.from({ length: 42 }).map((_, i) => (
              <View key={i} style={{ width: (i * 7) % 3 + 1.5, height: 34, backgroundColor: "rgba(255,255,255,0.85)", marginRight: 2.5 }} />
            ))}
          </View>
          <Text style={styles.cardNo}>{profile?.employeeId ?? "ANANTA-ID"}</Text>
        </LinearGradient>
      </Animated.View>
      <Text style={styles.note}>If any detail is wrong, contact your manager or raise a support ticket from Profile.</Text>
    </View>
  );
}

function Field({ label, value }) {
  return (
    <View style={{ width: "48%", marginBottom: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  card: { borderRadius: radius.xl, padding: spacing.xl, overflow: "hidden" },
  blobA: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(232,163,61,0.14)", top: -80, right: -50 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logo: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  logoText: { color: colors.white, fontWeight: "800", fontSize: 19 },
  company: { color: colors.white, fontWeight: "800", fontSize: 14, letterSpacing: 0.6 },
  companySub: { color: "rgba(255,255,255,0.55)", fontSize: 9, letterSpacing: 1.4, marginTop: 1 },
  personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  name: { color: colors.white, fontSize: 20, fontWeight: "800" },
  role: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: spacing.xl },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 },
  fieldValue: { color: colors.white, fontSize: 13, fontWeight: "700", marginTop: 2 },
  barcode: { flexDirection: "row", alignItems: "flex-end", marginTop: spacing.lg, opacity: 0.9 },
  cardNo: { color: "rgba(255,255,255,0.65)", fontSize: 11, letterSpacing: 3, marginTop: 6, textAlign: "center" },
  note: { fontSize: 12, color: colors.graphite500, textAlign: "center", marginTop: spacing.lg }
});
