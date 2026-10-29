import { useState } from "react";
import { toast } from "@/components/Toast";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActionSheetIOS, Platform } from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import * as Haptics from "@/lib/haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ScreenHeader, Card, Badge } from "@/components/ui";
import { DocumentPreview } from "@/components/DocumentPreview";
import { BrandFooter } from "@/components/BrandFooter";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useMyDocuments, useUploadDocument } from "./documentsApi";
import { colors, spacing } from "@/theme";

const REQUIRED_DOCUMENT_TYPES = [
  { type: "PROFILE_PHOTO", label: "Profile photo" },
  { type: "AADHAAR", label: "Aadhaar card" },
  { type: "PAN", label: "PAN card" },
  { type: "DRIVING_LICENCE", label: "Driving licence (optional)" },
  { type: "VOTER_ID", label: "Voter ID (optional)" },
];

async function pickImage(source) {
  // react-native-image-picker handles the runtime permission prompts
  // itself (AndroidManifest CAMERA / media permissions are declared).
  const options = { mediaType: "photo", quality: 0.7, saveToPhotos: false };
  const result = source === "camera" ? await launchCamera(options) : await launchImageLibrary(options);

  if (result.didCancel) return { canceled: true, assets: null };
  if (result.errorCode) {
    toast.error(
      "Permission needed",
      `Please allow ${source === "camera" ? "camera" : "photo library"} access to upload documents.`
    );
    return { canceled: true, assets: null };
  }
  const asset = result.assets?.[0];
  if (!asset) return { canceled: true, assets: null };
  return {
    canceled: false,
    assets: [{ uri: asset.uri, fileName: asset.fileName, mimeType: asset.type }]
  };
}

export function WorkerDocumentsScreen() {
  const [previewDoc, setPreviewDoc] = useState(null);
  const { data: documents, isLoading } = useMyDocuments();
  const upload = useUploadDocument();

  const docsByType = new Map((documents ?? []).map((d) => [d.type, d]));

  const handleUpload = (docType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const choose = (source) => {
      pickImage(source).then((result) => {
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        upload.mutate(
          {
            type: docType,
            uri: asset.uri,
            fileName: asset.fileName ?? `${docType}.jpg`,
            mimeType: asset.mimeType ?? "image/jpeg",
          },
          {
            onSuccess: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              toast.success("Uploaded", "Your document was uploaded and is pending admin verification.");
            },
            onError: (err) => toast.error("Upload failed", err instanceof Error ? err.message : "Unknown error"),
          }
        );
      });
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Library"], cancelButtonIndex: 0 },
        (index) => {
          if (index === 1) choose("camera");
          if (index === 2) choose("library");
        }
      );
    } else {
      Alert.alert("Upload document", "Choose a source", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: () => choose("camera") },
        { text: "Choose from Library", onPress: () => choose("library") },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <ScreenHeader
        title="Documents"
        subtitle="Upload the documents below. Admin will review and verify each one before your account is activated."
      />

      {isLoading ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : (
        REQUIRED_DOCUMENT_TYPES.map(({ type, label }, index) => {
          const doc = docsByType.get(type);
          return (
            <Animated.View key={type} entering={FadeInDown.delay(index * 60).duration(350)}>
              <Card style={styles.docCard}>
                <View style={styles.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docLabel}>{label}</Text>
                    {doc?.verificationStatus === "REJECTED" && doc.rejectionReason && (
                      <Text style={styles.rejectionReason}>Rejected: {doc.rejectionReason}</Text>
                    )}
                  </View>
                  {doc ? (
                    <Badge
                      label={doc.verificationStatus}
                      tone={doc.verificationStatus === "VERIFIED" ? "positive" : doc.verificationStatus === "REJECTED" ? "negative" : "amber"}
                    />
                  ) : (
                    <Badge label="Not uploaded" tone="neutral" />
                  )}
                </View>
                <View style={styles.actionsRow}>
                  {doc?.url && (
                    <Pressable
                      style={({ pressed }) => [styles.previewButton, pressed && { opacity: 0.85 }]}
                      onPress={() => setPreviewDoc(doc)}
                      accessibilityLabel={`Preview ${label}`}
                    >
                      <Ionicons name="eye-outline" size={15} color="#fff" />
                      <Text style={styles.previewButtonText}>Preview</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.uploadButton, styles.flexBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => handleUpload(type)}
                    disabled={upload.isPending}
                  >
                    <Text style={styles.uploadButtonText}>
                      {doc ? (doc.verificationStatus === "REJECTED" ? "Re-upload" : "Replace") : "Upload"}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            </Animated.View>
          );
        })
      )}
      <DocumentPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <BrandFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  loading: { fontSize: 13, color: colors.graphite500 },
  docCard: { marginBottom: spacing.sm, gap: spacing.sm },
  docRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  docLabel: { fontSize: 14, fontWeight: "600", color: colors.graphite900 },
  rejectionReason: { fontSize: 12, color: colors.rust, marginTop: 2 },
  uploadButton: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  uploadButtonText: { fontSize: 13, fontWeight: "600", color: colors.graphite900 },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  flexBtn: { flex: 1 },
  previewButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.navy, borderRadius: 5, paddingVertical: 8,
  },
  previewButtonText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
