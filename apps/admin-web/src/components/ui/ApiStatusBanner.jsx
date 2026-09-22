import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { api } from "@/lib/apiClient";

/**
 * Polls the public GET /status endpoint and shows a banner when the API
 * server can't be reached (the usual cause: only the web app was started).
 * Renders nothing while the API is healthy.
 */
export function ApiStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      await api.get("/status", { timeout: 8000 });
      setOffline(false);
    } catch (err) {
      // Only connectivity failures mean "API down". An HTTP status (401/403/
      // 422/…) proves the server answered, so leave the banner hidden.
      const answered = Boolean(err?.response?.status);
      const unreachableCode = err?.response?.data?.error?.code === "API_UNREACHABLE";
      setOffline(!answered || unreachableCode);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-rust/25 bg-rust-50 px-4 py-3 text-sm text-graphite-900"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rust/10 text-rust">
        <CloudOff size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">API server isn&apos;t reachable</p>
        <p className="mt-0.5 text-xs leading-5 text-graphite-600">
          The dashboard can&apos;t load data because the backend on port 4000 isn&apos;t answering. In a second
          terminal run <code className="rounded bg-graphite-900 px-1.5 py-0.5 font-mono text-[11px] text-paper">npm run dev:api</code>
          {" "}(or start everything at once with <code className="rounded bg-graphite-900 px-1.5 py-0.5 font-mono text-[11px] text-paper">npm run dev</code>).
          If the API crashes on boot, check MongoDB/Redis and your <code className="font-mono text-[11px]">.env</code> — see README “Running locally”.
        </p>
      </div>
      <button
        type="button"
        className="btn-ghost shrink-0"
        onClick={check}
        disabled={checking}
      >
        <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
        {checking ? "Checking…" : "Retry"}
      </button>
    </div>
  );
}
