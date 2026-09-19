import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { OfflineAttendanceQueue } from "@/offline/attendanceQueue";
import NetInfo from "@react-native-community/netinfo";

export function useManagedSites() {
  return useQuery({
    queryKey: ["manager", "sites"],
    queryFn: async () => unwrap(api.get("/sites"))
  });
}

export function useManagedWorkers() {
  return useQuery({
    queryKey: ["manager", "workers"],
    queryFn: async () => unwrap(api.get("/workers"))
  });
}

export function useTodayAttendance(site, date) {
  return useQuery({
    queryKey: ["manager", "attendance", site, date],
    queryFn: async () =>
    unwrap(
      api.get(`/attendance?site=${site}&from=${date}&to=${date}`)
    ),
    enabled: Boolean(site)
  });
}

/**
 * Marks attendance. If online, submits directly. If offline, enqueues via
 * OfflineAttendanceQueue instead — the whole point of §45 in the spec.
 */
export function useMarkAttendance() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input) =>

    {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await OfflineAttendanceQueue.enqueue(input);
        return { queued: true };
      }
      await unwrap(api.post("/attendance", input));
      return { queued: false };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager", "attendance"] });
    }
  });
}

export function useSubmitAdvanceOnBehalf() {
  return useMutation({
    mutationFn: async (input) =>
    unwrap(api.post("/advances", input))
  });
}

export function useSubmitKharchiOnBehalf() {
  return useMutation({
    mutationFn: async (input) =>

    unwrap(api.post("/kharchi", input))
  });
}