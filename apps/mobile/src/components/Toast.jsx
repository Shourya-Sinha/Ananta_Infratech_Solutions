import { View, Text, StyleSheet, Pressable } from "react-native";
import { create } from "zustand";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, shadow } from "@/theme";

/**
 * Custom in-app toasts (replaces system Alert popups for messages).
 * Usage anywhere:  toast.success("Saved", "Attendance marked.")
 *                  toast.error("Couldn't register", err.message)
 * Toasts slide in at the top, auto-dismiss, and have a close (×) button.
 * Interactive choices (Delete? / Take Photo vs Library) intentionally
 * still use Alert — a toast can't ask a question.
 */
let nextId = 1;

export const useToastStore = create((set, get) => ({
  toasts: [],
  show: ({ type = "info", title, message, duration = 4500 }) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, type, title, message }] }));
    setTimeout(() => get().dismiss(id), duration);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] })
}));

export const toast = {
  show: (opts) => useToastStore.getState().show(opts),
  success: (title, message) => useToastStore.getState().show({ type: "success", title, message }),
  error: (title, message) => useToastStore.getState().show({ type: "error", title, message, duration: 6000 }),
  info: (title, message) => useToastStore.getState().show({ type: "info", title, message }),
  warning: (title, message) => useToastStore.getState().show({ type: "warning", title, message })
};

const TYPE_STYLE = {
  success: { icon: "checkmark-circle", color: colors.teal, bg: colors.teal50 },
  error: { icon: "alert-circle", color: colors.rust, bg: colors.rust50 },
  warning: { icon: "warning", color: colors.amber600, bg: colors.amber50 },
  info: { icon: "information-circle", color: colors.sky, bg: "#E8F0F8" }
};

/** Mounted once at the app root (App.jsx). */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 10 }]}>
      {toasts.map((t) => {
        const meta = TYPE_STYLE[t.type] ?? TYPE_STYLE.info;
        return (
          <Animated.View
            key={t.id}
            entering={FadeInDown.duration(280).springify().damping(19)}
            exiting={FadeOutUp.duration(200)}
            style={[styles.card, { borderLeftColor: meta.color }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              {!!t.title && <Text style={styles.title}>{t.title}</Text>}
              {!!t.message && <Text style={styles.message}>{t.message}</Text>}
            </View>
            <Pressable onPress={() => dismiss(t.id)} accessibilityLabel="Dismiss notification" hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={16} color={colors.graphite500} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: spacing.md, right: spacing.md, zIndex: 999, gap: spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    ...shadow.lifted
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13.5, fontWeight: "800", color: colors.graphite900 },
  message: { fontSize: 12.5, color: colors.graphite700, marginTop: 1, lineHeight: 17 },
  close: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.steel100, alignItems: "center", justifyContent: "center" }
});
