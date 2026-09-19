import { useEffect, useState, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import { OfflineAttendanceQueue } from "@/offline/attendanceQueue";

export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await OfflineAttendanceQueue.getPendingCount());
  }, []);

  useEffect(() => {
    refreshPendingCount();

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    const unsubscribeSync = OfflineAttendanceQueue.subscribeToConnectivity(async () => {
      const result = await OfflineAttendanceQueue.syncPending();
      if (result.synced > 0 || result.failed > 0) await refreshPendingCount();
    });

    return () => {
      unsubscribeNet();
      unsubscribeSync();
    };
  }, [refreshPendingCount]);

  return { isOffline, pendingCount, refreshPendingCount };
}