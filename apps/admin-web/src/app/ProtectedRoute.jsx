import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

/**
 * The Admin Web panel is for SUPER_ADMIN accounts ONLY. Previously this
 * guard only checked "is someone logged in", so a Worker or Manager who
 * somehow obtained a token could open the whole admin UI (the API still
 * blocked their data calls by permission, but the panel itself must never
 * render for them). Role comes from the login/me payload (baseRole).
 */
export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  if (!accessToken) return <Navigate to="/login" replace />;
  const baseRole = user?.baseRole ?? user?.role;
  if (user && baseRole !== "SUPER_ADMIN") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f1115", color: "#e5e7eb", fontFamily: "system-ui" }}>
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Admin access only</h1>
          <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>
            This panel is only for Admin (Super Admin) accounts. Managers and workers please use the mobile app.
          </p>
          <button
            onClick={() => { clear(); window.location.href = "/login"; }}
            style={{ background: "#f59e0b", color: "#111827", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}
          >
            Log out
          </button>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
