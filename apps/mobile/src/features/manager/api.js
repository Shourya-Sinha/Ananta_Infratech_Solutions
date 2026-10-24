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
/** Live salary preview for one worker: rates, today, month-so-far, approx month. */
export function useWorkerSalaryPreview(workerId, month) {
  return useQuery({
    queryKey: ["manager", "salary-preview", workerId, month],
    queryFn: async () => unwrap(api.get(`/salary/worker/${workerId}/preview?month=${month}`)),
    enabled: Boolean(workerId)
  });
}

/** Set a worker's pay in one basis (HOURLY/DAILY/MONTHLY); API derives the rest. */
export function useSetSalaryRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workerId, mode, amountRupees }) =>
      unwrap(api.put(`/salary/worker/${workerId}/salary-rate`, { mode, amountRupees })),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["manager", "salary-preview", vars.workerId] });
      qc.invalidateQueries({ queryKey: ["manager", "workers"] });
    }
  });
}

/** Per-site monthly finance: billing vs salary/expenses/investment, P/L + daily approx. */
export function useSiteFinanceDashboard(siteId, month) {
  return useQuery({
    queryKey: ["manager", "site-finance", siteId, month],
    queryFn: async () => unwrap(api.get(`/finance/site/${siteId}/dashboard?month=${month}`)),
    enabled: Boolean(siteId)
  });
}

/** Admin only (site.billing.manage): set this month's client billing for a site. */
export function useSetSiteBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => unwrap(api.put("/finance/site-billing", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manager", "site-finance"] })
  });
}
