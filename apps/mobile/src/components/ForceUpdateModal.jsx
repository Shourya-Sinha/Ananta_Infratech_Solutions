import { View, Text, Modal, Pressable, StyleSheet, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useForceUpdateStore, APP_VERSION } from "@/lib/version";
import { colors, spacing, radius } from "@/theme";

/**
 * STRICT mobile update popup (total version control): when the server
 * release no longer matches this installed build, the app is locked
 * behind this screen. There is deliberately NO close button and the
 * hardware back button is swallowed (onRequestClose does nothing) —
 * the only way forward is "Update the app", which opens the store /
 * update link provided by the server.
 */
export function ForceUpdateModal() {
  const required = useForceUpdateStore((s) => s.required);
  const insets = useSafeAreaInsets();
  if (!required) return null;

  const openUpdate = () => {
    const url = required.updateUrl || "https://play.google.com/store";
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={() => {}} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="arrow-up-circle-outline" size={40} color={colors.gold} />
        </View>
        <Text style={styles.title}>Update required</Text>
        <Text style={styles.body}>
          {required.message ??
            "A new version of Ananta Infratech is required to continue. Please update the app — your account and data are safe."}
        </Text>

        <View style={styles.versions}>
          <View style={styles.versionBox}>
            <Text style={styles.versionLabel}>Your app</Text>
            <Text style={[styles.versionValue, { color: "#F08A80" }]}>v{required.currentVersion ?? APP_VERSION}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.5)" />
          <View style={styles.versionBox}>
            <Text style={styles.versionLabel}>Required</Text>
            <Text style={[styles.versionValue, { color: colors.tealBright }]}>v{required.requiredVersion ?? "latest"}</Text>
          </View>
        </View>

        <Pressable onPress={openUpdate} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} accessibilityLabel="Update the app now">
          <Ionicons name="download-outline" size={18} color={colors.navy} />
          <Text style={styles.buttonText}>Update the app</Text>
        </Pressable>
        <Text style={styles.note}>This update is mandatory — the app cannot be used until it is updated to the matching version.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 76, height: 76, borderRadius: 38, marginBottom: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center"
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center" },
  body: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: spacing.sm },
  versions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  versionBox: {
    backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "center", minWidth: 110
  },
  versionLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  versionValue: { fontSize: 17, fontWeight: "800", marginTop: 3, fontVariant: ["tabular-nums"] },
  button: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.gold, borderRadius: radius.pill,
    paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, marginTop: spacing.xl
  },
  buttonText: { color: colors.navy, fontSize: 15, fontWeight: "800" },
  note: { color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center", marginTop: spacing.lg, lineHeight: 17 }
});
