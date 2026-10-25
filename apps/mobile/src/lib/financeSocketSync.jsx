import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";

/**
 * Real-time finance for mobile: the API emits `finance:updated` for every
 * money-moving change (wage/rate edits, attendance earnings, advances,
 * Kharchi, site finance, payroll). When it arrives, all cached queries
 * (salary, home totals, finance dashboards, statements) are invalidated
 * so managers and workers see updated totals immediately — no pull-to-
 * refresh, no app restart. Bursts are coalesced (250 ms) like Admin Web.
 * Renders nothing.
 */
export function FinanceSocketSync() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const timer = useRef(null);

  useEffect(() => {
    if (!accessToken) return undefined;
    const socket = getSocket();
    socket.auth = { token: accessToken };
    if (!socket.connected) socket.connect();
    const refresh = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        queryClient.invalidateQueries();
      }, 250);
    };
    socket.on("finance:updated", refresh);
    socket.on("salary:rate_updated", refresh);
    return () => {
      socket.off("finance:updated", refresh);
      socket.off("salary:rate_updated", refresh);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [accessToken, queryClient]);

  return null;
}
