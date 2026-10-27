import { create } from "zustand";
import { APP_VERSION } from "@/config";
export { APP_VERSION };

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
