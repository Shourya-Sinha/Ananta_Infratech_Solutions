/* global __APP_VERSION__ */
import { create } from "zustand";
/** This Admin Web build's release version — baked in by Vite from
 * packages/constants/src/version.js; must equal the server's release. */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

/**
 * Strict force-refresh state. Set by the API client whenever the server
 * says this UI is outdated (HTTP 426 FORCE_UPDATE) or a response arrives
 * stamped with a different release version. The ForceUpdateModal renders
 * from this store and cannot be dismissed — the only action is a hard
 * refresh that loads the newly deployed UI bundle.
 */
export const useForceUpdateStore = create((set) => ({
  required: null, // { currentVersion, requiredVersion, message }
  trigger: (details) =>
    set((s) => (s.required ? s : { required: details })),
  clear: () => set({ required: null })
}));

/** Check the public version endpoint (used on load + window focus). */
export async function checkServerVersion() {
  try {
    const res = await fetch("/api/v1/system/version", {
      headers: { "x-client": "admin-web", "x-app-version": APP_VERSION }
    });
    if (!res.ok) return;
    const body = await res.json();
    const latest = body?.data?.latest?.adminWeb;
    if (latest && latest !== APP_VERSION) {
      useForceUpdateStore.getState().trigger({
        currentVersion: APP_VERSION,
        requiredVersion: latest,
        message: body.data.updateMessage
      });
    }
  } catch {
    // API offline is handled by other banners; version check is best-effort.
  }
}
