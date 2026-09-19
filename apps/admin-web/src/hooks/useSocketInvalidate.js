import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

/**
 * Subscribes to a Socket.IO event for the lifetime of the component and
 * invalidates the given React Query keys whenever it fires — this is what
 * makes dashboards update live without a manual refresh (spec §20/§44).
 */
export function useSocketInvalidate(event, queryKeys) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const handler = () => {
      queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    };
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, JSON.stringify(queryKeys)]);
}