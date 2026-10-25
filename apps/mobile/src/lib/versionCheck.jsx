import { useEffect } from "react";
import { AppState } from "react-native";
import { api, unwrap } from "@/lib/apiClient";
import { APP_VERSION, useForceUpdateStore } from "@/lib/version";

/**
 * Total version control, proactive side: on app start and whenever the
 * app returns to the foreground, ask the server which release it runs.
 * If it no longer matches this installed build, lock the app behind the
 * strict ForceUpdateModal (the API's 426 responses do the same thing
 * reactively for any request made in between). Renders nothing.
 */
export function VersionCheck() {
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const info = await unwrap(api.get("/system/version"));
        if (!alive) return;
        const latest = info?.latest?.mobile;
        if (latest && latest !== APP_VERSION) {
          useForceUpdateStore.getState().trigger({
            currentVersion: APP_VERSION,
            requiredVersion: latest,
            updateUrl: info?.updateUrl?.mobile || undefined,
            message: info?.updateMessage
          });
        }
      } catch {
        // 426 already triggers via the API interceptor; network errors are
        // handled by the screens themselves. Version check is best-effort.
      }
    };
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => { alive = false; sub.remove(); };
  }, []);
  return null;
}
