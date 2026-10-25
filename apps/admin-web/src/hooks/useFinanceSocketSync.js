import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

/**
 * Real-time financial management: the API emits ONE `finance:updated`
 * WebSocket event for every money-moving change — per-day wage / salary
 * rate edits, attendance earnings, advances, Kharchi, site income /
 * expense / investment / billing, company expenses and payroll.
 *
 * Mounted once in AppShell, this listens and refreshes EVERY financial
 * query (dashboard totals, finance P&L, payroll sheets, salary statements
 * and previews, advance/Kharchi lists, worker rates) immediately — no
 * page reload, no matter which admin/manager/worker made the change.
 *
 * Bursts (e.g. bulk attendance marking posts dozens of earnings in a
 * second) are coalesced into a single invalidation pass after 250 ms.
 */
const FINANCE_QUERY_ROOTS = [
  ["finance"],
  ["payroll"],
  ["salary"],
  ["advances"],
  ["kharchi"],
  ["workers"],
  ["sites"]
];

export function useFinanceSocketSync() {
  const queryClient = useQueryClient();
  const timer = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        FINANCE_QUERY_ROOTS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }, 250);
    };
    socket.on("finance:updated", refresh);
    socket.on("salary:rate_updated", refresh);
    socket.on("site:billing_updated", refresh);
    return () => {
      socket.off("finance:updated", refresh);
      socket.off("salary:rate_updated", refresh);
      socket.off("site:billing_updated", refresh);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [queryClient]);
}
