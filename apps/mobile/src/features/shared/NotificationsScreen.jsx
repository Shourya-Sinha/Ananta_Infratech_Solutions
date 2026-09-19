import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useNotifications, useMarkNotificationRead } from "./api";
import { ScreenHeader, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";

export function NotificationsScreen() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notifications" />
      {!data || data.items.length === 0 ?
      <EmptyState title="No notifications" body="You're all caught up." /> :

      <FlatList
        data={data.items}
        keyExtractor={(n) => n._id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) =>
        <Pressable
          style={[styles.item, !item.read && styles.itemUnread]}
          onPress={() => !item.read && markRead.mutate(item._id)}>
          
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{new Date(item.createdAt).toLocaleString("en-IN")}</Text>
            </Pressable>
        } />

      }
    </View>);

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.steel200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs
  },
  itemUnread: { backgroundColor: colors.amber50, borderColor: colors.amber },
  title: { fontSize: 14, fontWeight: "600", color: colors.graphite900 },
  body: { fontSize: 13, color: colors.graphite500, marginTop: 2 },
  time: { fontSize: 11, color: colors.graphite300, marginTop: 4 }
});