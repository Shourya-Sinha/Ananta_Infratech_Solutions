import { useState } from "react";
import { View, Text, FlatList, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useMyTickets, useTicketMessages, useCreateTicket, usePostMessage } from "./api";
import { Button, ScreenHeader, EmptyState, Badge } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";

export function SupportScreen() {
  const { data: tickets } = useMyTickets();
  const [activeTicket, setActiveTicket] = useState(null);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [reply, setReply] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: messages } = useTicketMessages(activeTicket ?? undefined);
  const createTicket = useCreateTicket();
  const postMessage = usePostMessage(activeTicket ?? undefined);

  if (activeTicket) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Text style={styles.backLink} onPress={() => setActiveTicket(null)}>
          ‹ Back to tickets
        </Text>
        <FlatList
          data={messages ?? []}
          keyExtractor={(m) => m._id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          renderItem={({ item }) =>
          <View style={styles.message}>
              <Text style={styles.messageSender}>{item.sender?.name}</Text>
              <Text style={styles.messageBody}>{item.body}</Text>
            </View>
          } />
        
        <View style={styles.replyRow}>
          <TextInput style={styles.replyInput} placeholder="Type a reply…" value={reply} onChangeText={setReply} />
          <Button
            title="Send"
            onPress={() => {
              if (reply.trim()) {
                postMessage.mutate(reply, { onSuccess: () => setReply("") });
              }
            }} />
          
        </View>
      </KeyboardAvoidingView>);

  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Support" subtitle="Contact admin for help" />

      <Button title={showNewForm ? "Cancel" : "New ticket"} onPress={() => setShowNewForm((v) => !v)} variant="accent" />

      {showNewForm &&
      <View style={styles.newForm}>
          <TextInput style={styles.input} placeholder="Subject" value={newSubject} onChangeText={setNewSubject} />
          <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Describe your issue…"
          multiline
          value={newMessage}
          onChangeText={setNewMessage} />
        
          <Button
          title={createTicket.isPending ? "Submitting…" : "Submit"}
          onPress={() => {
            if (newSubject && newMessage) {
              createTicket.mutate(
                { subject: newSubject, message: newMessage },
                {
                  onSuccess: () => {
                    setShowNewForm(false);
                    setNewSubject("");
                    setNewMessage("");
                  }
                }
              );
            }
          }} />
        
        </View>
      }

      {!tickets || tickets.length === 0 ?
      <EmptyState title="No support tickets" body="Start a new ticket if you need help from admin." /> :

      <FlatList
        data={tickets}
        keyExtractor={(t) => t._id}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}
        renderItem={({ item }) =>
        <View style={styles.ticketRow} onTouchEnd={() => setActiveTicket(item._id)}>
              <View>
                <Text style={styles.ticketSubject}>{item.subject}</Text>
                <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
              </View>
              <Badge label={item.status.replace("_", " ")} tone={item.status === "RESOLVED" ? "positive" : "amber"} />
            </View>
        } />

      }
    </View>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  backLink: { color: colors.amber, fontSize: 13, fontWeight: "600", marginBottom: spacing.sm },
  message: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs },
  messageSender: { fontSize: 11, fontWeight: "600", color: colors.graphite500 },
  messageBody: { fontSize: 14, color: colors.graphite900, marginTop: 2 },
  replyRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.surface
  },
  newForm: { gap: spacing.sm, marginVertical: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.surface
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs
  },
  ticketSubject: { fontSize: 14, fontWeight: "600", color: colors.graphite900 },
  ticketNumber: { fontSize: 12, color: colors.graphite500, marginTop: 2 }
});