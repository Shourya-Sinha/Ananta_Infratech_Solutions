import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export function useMyProfile() {
  return useQuery({
    queryKey: ["worker", "me"],
    queryFn: async () => unwrap(api.get("/workers/me")),
    retry: false
  });
}

export function useWorkTypes() {
  return useQuery({
    queryKey: ["work-types"],
    queryFn: async () => unwrap(api.get("/work-types"))
  });
}

export function useCreateOwnProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workTypeId) => unwrap(api.post("/workers/me", { workTypeId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worker", "me"] })
  });
}

export function useMyAttendance(from, to) {
  return useQuery({
    queryKey: ["worker", "attendance", from, to],
    queryFn: async () => unwrap(
      api.get(`/attendance?from=${from}&to=${to}`)
    )
  });
}

export function useMySalarySummary(workerId, month) {
  return useQuery({
    queryKey: ["worker", "salary-summary", workerId, month],
    queryFn: async () =>
    unwrap(

      api.get(`/salary/worker/${workerId}/summary?month=${month}`)),
    enabled: Boolean(workerId)
  });
}

export function useMyLedger(workerId) {
  return useQuery({
    queryKey: ["worker", "ledger", workerId],
    queryFn: async () =>
    unwrap(
      api.get(`/salary/worker/${workerId}/ledger`)
    ),
    enabled: Boolean(workerId)
  });
}

export function useMyAdvances(workerId) {
  return useQuery({
    queryKey: ["worker", "advances", workerId],
    queryFn: async () =>
    unwrap(
      api.get(`/advances?worker=${workerId}`)
    ),
    enabled: Boolean(workerId)
  });
}

export function useMyKharchi(workerId) {
  return useQuery({
    queryKey: ["worker", "kharchi", workerId],
    queryFn: async () =>
    unwrap(
      api.get(`/kharchi?worker=${workerId}`)
    ),
    enabled: Boolean(workerId)
  });
}

export function useRequestAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) =>
    unwrap(api.post("/advances", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worker", "advances"] })
  });
}

export function useRequestKharchi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) =>

    unwrap(api.post("/kharchi", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worker", "kharchi"] })
  });
}