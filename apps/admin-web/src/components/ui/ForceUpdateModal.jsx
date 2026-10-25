import { RefreshCw, TriangleAlert } from "lucide-react";
import { useForceUpdateStore, APP_VERSION } from "@/lib/version";

/**
 * STRICT admin update popup: shown when this open tab is running an old
 * UI build against a newer server (total version control). It has no
 * close button, cannot be dismissed with Escape/backdrop, and blocks the
 * whole panel — the only action is "Refresh now", which hard-reloads the
 * page bypassing cache so the browser fetches the newly deployed bundle
 * whose version matches the server.
 */
export function ForceUpdateModal() {
  const required = useForceUpdateStore((s) => s.required);
  if (!required) return null;

  const refresh = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", required.requiredVersion ?? String(Date.now()));
    window.location.replace(url.toString());
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-graphite-950/80 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label="Admin panel update required">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <TriangleAlert size={28} />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold text-graphite-900">Admin panel update required</h2>
        <p className="mt-2 text-sm leading-relaxed text-graphite-500">
          {required.message ?? "A new version of the admin panel has been deployed. Please refresh to load the latest version — this tab is running an older build than the server."}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-steel-50 p-3 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-graphite-500">This tab</dt>
            <dd className="font-mono font-semibold text-rust">v{required.currentVersion ?? APP_VERSION}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-graphite-500">Required</dt>
            <dd className="font-mono font-semibold text-teal">v{required.requiredVersion ?? "latest"}</dd>
          </div>
        </dl>
        <button onClick={refresh} className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 !py-3 text-sm">
          <RefreshCw size={16} /> Refresh now
        </button>
        <p className="mt-3 text-[11px] text-graphite-300">This message cannot be dismissed — the panel stays locked until it is refreshed to the matching version.</p>
      </div>
    </div>
  );
}
