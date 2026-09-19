import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { Button, ScreenHeader, Card } from "@/components/ui";
import { colors, spacing } from "@/theme";

export function AddWorkerScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");

  const { data: workTypes } = useQuery({
    queryKey: ["work-types"],
    queryFn: async () => unwrap(api.get("/work-types"))
  });

  const registerStart = useMutation({
    mutationFn: async () => unwrap(api.post("/auth/register/start", { fullName, phone, address }))
  });

  const selectWorkType = useMutation({
    mutationFn: async (userId) => unwrap(api.post("/workers", { userId, workTypeId }))
  });

  const submit = async () => {
    if (!fullName || !phone || !address || !workTypeId) {
      Alert.alert("Missing information", "Please fill in all fields and select a work type.");
      return;
    }
    try {
      const { userId, devOtp } = await registerStart.mutateAsync();
      await selectWorkType.mutateAsync(userId);
      Alert.alert(
        "Worker registered",
        devOtp ?
        `Registration started. Dev OTP: ${devOtp}. The worker must verify this OTP and upload documents from their own phone, then Admin verifies and activates.` :
        "Registration started. The worker must verify their OTP and upload documents, then Admin verifies and activates."
      );
      navigation.goBack();
    } catch (err) {
      Alert.alert("Could not register worker", err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <ScreenHeader title="Add worker" subtitle="Registration steps 1–2: basic info + work type" />

      <Card style={{ gap: spacing.sm }}>
        <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Rahul Kumar" />
        <Field label="Mobile number" value={phone} onChangeText={setPhone} placeholder="9876543210" keyboardType="phone-pad" />
        <Field label="Address" value={address} onChangeText={setAddress} placeholder="Village, District, State" />

        <Text style={styles.label}>Work type</Text>
        <View style={styles.workTypeGrid}>
          {workTypes?.map((wt) =>
          <Text
            key={wt.id}
            onPress={() => setWorkTypeId(wt.id)}
            style={[styles.workTypeChip, workTypeId === wt.id && styles.workTypeChipActive]}>
            
              {wt.name}
            </Text>
          )}
        </View>

        <Button
          title={registerStart.isPending || selectWorkType.isPending ? "Registering…" : "Register worker"}
          onPress={submit}
          variant="accent" />
        
      </Card>

      <Text style={styles.note}>
        The worker will need to verify their phone via OTP and upload identity documents from their own device
        before Admin can activate the account.
      </Text>
    </ScrollView>);

}

function Field(props) {
  return (
    <View>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        placeholder={props.placeholder}
        placeholderTextColor={colors.graphite300}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType} />
      
    </View>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  label: { fontSize: 12, fontWeight: "600", color: colors.graphite500, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.graphite900
  },
  workTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  workTypeChip: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    color: colors.graphite500,
    overflow: "hidden"
  },
  workTypeChipActive: { backgroundColor: colors.amber50, borderColor: colors.amber, color: colors.amber600 },
  note: { fontSize: 12, color: colors.graphite500, marginTop: spacing.md, textAlign: "center" }
});