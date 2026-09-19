import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export function useWorkers(filters) {
  const qs = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ["workers", filters],
    queryFn: async () => unwrap(api.get(`/workers?${qs}`))
  });
}

export function useWorker(id) {
  return useQuery({
    queryKey: ["workers", id],
    queryFn: async () => unwrap(api.get(`/workers/${id}`)),
    enabled: Boolean(id)
  });
}

export function useWorkTypes() {
  return useQuery({
    queryKey: ["work-types"],
    queryFn: async () =>
    unwrap(
      api.get("/work-types")
    )
  });
}

export function useSitesForSelect() {
  return useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites"))
  });
}

function useInvalidateWorkers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["workers"] });
}

export function useVerifyDocuments() {
  const invalidate = useInvalidateWorkers();
  return useMutation({
    mutationFn: async (workerId) => unwrap(api.post(`/workers/${workerId}/verify-documents`)),
    onSuccess: invalidate
  });
}

export function useVerifyWorkType() {
  const invalidate = useInvalidateWorkers();
  return useMutation({
    mutationFn: async (workerId) => unwrap(api.post(`/workers/${workerId}/verify-work-type`)),
    onSuccess: invalidate
  });
}

export function useActivateWorker() {
  const invalidate = useInvalidateWorkers();
  return useMutation({
    mutationFn: async (workerId) => unwrap(api.post(`/workers/${workerId}/activate`)),
    onSuccess: invalidate
  });
}

export function useRejectWorker() {
  const invalidate = useInvalidateWorkers();
  return useMutation({
    mutationFn: async ({ workerId, reason }) =>
    unwrap(api.post(`/workers/${workerId}/reject`, { reason })),
    onSuccess: invalidate
  });
}

export function useAssignSite() {
  const invalidate = useInvalidateWorkers();
  return useMutation({
    mutationFn: async ({ workerId, siteId }) =>
    unwrap(api.post(`/workers/${workerId}/assign-site`, { siteId })),
    onSuccess: invalidate
  });
}

export function useCreateWorker() {
  const invalidate = useInvalidateWorkers();
  return useMutation({
    mutationFn: async (input) => unwrap(api.post("/workers", input)),
    onSuccess: invalidate
  });
}