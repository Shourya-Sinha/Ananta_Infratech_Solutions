import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cx } from "@/lib/format";

/**
 * Lightweight toast system: `const toast = useToast()` then
 * `toast.success("Attendance saved")`, `toast.error(err.message)` (shows the
 * server's error message), `toast.info("…")`. Toasts stack bottom-right and
 * auto-dismiss after 5 seconds (errors stay 8s). Used on every mutating
 * action so the admin always sees the request result with the server message.
 */

const ToastContext = createContext(null);

let nextId = 1;

const TONES = {
  success: {
    icon: CheckCircle2,
    bar: "bg-teal",
    iconClass: "text-teal"
  },
  error: {
    icon: TriangleAlert,
    bar: "bg-rust",
    iconClass: "text-rust"
  },
  info: {
    icon: Info,
    bar: "bg-graphite-500",
    iconClass: "text-graphite-500"
  }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone, message, title) => {
      if (!message) return;
      const id = nextId++;
      const toast = {
        id,
        tone,
        title: title ?? (tone === "error" ? "Request failed" : tone === "success" ? "Success" : "Notice"),
        message: String(message)
      };
      setToasts((list) => [...list.slice(-4), toast]); // keep at most 5 visible
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000)
      );
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message, title) => push("success", message, title),
      error: (message, title) => push("error", message, title),
      info: (message, title) => push("info", message, title)
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const tone = TONES[t.tone] ?? TONES.info;
          const Icon = tone.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={cx(
                "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded border border-steel-200 bg-surface p-3 pl-4 shadow-lg",
                "animate-[toast-in_180ms_ease-out]"
              )}>

              <span className={cx("absolute inset-y-0 left-0 w-1", tone.bar)} />
              <Icon size={18} className={cx("mt-0.5 shrink-0", tone.iconClass)} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-graphite-900">{t.title}</p>
                <p className="mt-0.5 break-words text-sm text-graphite-500">{t.message}</p>
              </div>
              <button
                className="shrink-0 text-graphite-300 transition-colors duration-150 hover:text-graphite-700"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification">

                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Pages rendered outside the provider (e.g. tests) still work — toasts no-op.
    return { success: () => {}, error: () => {}, info: () => {} };
  }
  return ctx;
}
