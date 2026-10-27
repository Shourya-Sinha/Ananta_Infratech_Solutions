import ReactNativeHapticFeedback from "react-native-haptic-feedback";

/**
 * Drop-in replacement for the small slice of expo-haptics this app used
 * (selectionAsync / impactAsync / notificationAsync), backed by
 * react-native-haptic-feedback so call sites didn't have to change.
 */
const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

export const ImpactFeedbackStyle = { Light: "impactLight", Medium: "impactMedium", Heavy: "impactHeavy" };
export const NotificationFeedbackType = { Success: "notificationSuccess", Warning: "notificationWarning", Error: "notificationError" };

export async function selectionAsync() {
  ReactNativeHapticFeedback.trigger("selection", options);
}

export async function impactAsync(style = ImpactFeedbackStyle.Light) {
  ReactNativeHapticFeedback.trigger(style ?? "impactLight", options);
}

export async function notificationAsync(type = NotificationFeedbackType.Success) {
  ReactNativeHapticFeedback.trigger(type ?? "notificationSuccess", options);
}
