import { View, Text, Modal, Image, Pressable, StyleSheet, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { colors, spacing, radius } from "@/theme";

/**
 * Full-screen self-preview of an uploaded document (worker viewing their
 * own Aadhaar/PAN/photo, same experience as the admin preview):
 * the image fills the phone screen over everything, with a big RED ✕
 * close button at the top-right. Closing returns to the document list,
 * where the verification status / rejection reason is shown. PDFs (which
 * React Native cannot render inline) offer an "Open PDF" action instead.
 */
export function DocumentPreview({ doc, onClose }) {
  const insets = useSafeAreaInsets();
  const url = doc?.url;
  const mime = doc?.metadata?.mimeType ?? "";
  const isPdf = mime === "application/pdf" || /\.pdf($|\?)/i.test(url ?? "");
  const isImage = !isPdf && (mime.startsWith("image/") || /\.(jpe?g|png|webp)($|\?)/i.test(url ?? "") || Boolean(url));

  return (
    <Modal visible={Boolean(doc)} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={styles.title} numberOfLines={1}>
              {doc?.type?.replace(/_/g, " ") ?? "Document"}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {doc?.verificationStatus ?? ""}
              {doc?.createdAt ? ` · Uploaded ${new Date(doc.createdAt).toLocaleDateString("en-IN")}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close document preview"
            style={({ pressed }) => [styles.closeBtn, pressed && { transform: [{ scale: 0.94 }], backgroundColor: "#b91c1c" }]}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.body}>
          {!url ? (
            <Text style={styles.empty}>No preview available for this document.</Text>
          ) : isPdf ? (
            <View style={styles.pdfBox}>
              <Ionicons name="document-text-outline" size={44} color="rgba(255,255,255,0.55)" />
              <Text style={styles.empty}>PDF documents open in your PDF viewer.</Text>
              <Pressable style={styles.openBtn} onPress={() => Linking.openURL(url).catch(() => {})}>
                <Text style={styles.openBtnText}>Open PDF</Text>
              </Pressable>
            </View>
          ) : isImage ? (
            <Image source={{ uri: url }} style={styles.image} resizeMode="contain" accessibilityLabel={`${doc?.type ?? "Document"} preview`} />
          ) : (
            <Text style={styles.empty}>This file type cannot be previewed in the app.</Text>
          )}
        </View>

        <Text style={[styles.hint, { paddingBottom: insets.bottom + spacing.md }]}>
          Tap the red ✕ to close. Your verification status is shown in the document list.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm
  },
  title: { color: "#fff", fontSize: 17, fontWeight: "800", textTransform: "capitalize" },
  meta: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#dc2626",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#dc2626", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8
  },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  image: { width: "100%", height: "100%", borderRadius: radius.sm },
  empty: { color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
  pdfBox: { alignItems: "center", gap: spacing.md },
  openBtn: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  openBtnText: { color: colors.navy, fontWeight: "800", fontSize: 14 },
  hint: { color: "rgba(255,255,255,0.55)", fontSize: 12, textAlign: "center", paddingHorizontal: spacing.xl }
});
