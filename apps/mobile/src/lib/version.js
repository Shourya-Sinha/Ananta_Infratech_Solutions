import Constants from "expo-constants";
import { create } from "zustand";

/** This mobile build's version (app.json expo.version, bumped per release). */
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

/**
 * Strict force-update state (total version control). Set by the API
 * client on HTTP 426 FORCE_UPDATE, by a mismatched x-release-version
 * response header, or by the startup/foreground version check. The
 * ForceUpdateModal renders from this and CANNOT be dismissed — the only
 * action is updating the app.
 */
export const useForceUpdateStore = create((set) => ({
  required: null, // { currentVersion, requiredVersion, updateUrl, message }
  trigger: (details) => set((s) => (s.required ? s : { required: details })),
  clear: () => set({ required: null })
}));

export function versionHeaders() {
  return { "x-client": "mobile", "x-app-version": APP_VERSION };
}
