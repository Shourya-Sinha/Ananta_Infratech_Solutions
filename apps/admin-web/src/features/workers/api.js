import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export function useWorkers(filters, options) {
  const qs = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ["workers", filters],
    queryFn: async () => unwrap(api.get(`/workers?${qs}`)),
    ...options
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

/**
 * Super Admin "Add worker": one-shot registration (login account + worker
 * profile + optional initial site). The response carries the temporary
 * password exactly once for handover to the worker.
 */
export function useRegisterWorker() {
  const invalidate = useInvalidateWorkers();
  return useMutation({
    mutationFn: async (input) => unwrap(api.post("/workers/register", input)),
    onSuccess: invalidate
  });
}

export function useWorkerDocuments(workerId) {
  return useQuery({
    queryKey: ["worker-documents", workerId],
    queryFn: async () => unwrap(api.get(`/workers/${workerId}/documents`)),
    enabled: Boolean(workerId)
  });
}

function useInvalidateWorkerDocs(workerId) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["worker-documents", workerId] });
    qc.invalidateQueries({ queryKey: ["workers"] });
  };
}

/** Admin uploads a document on the worker's behalf (server uploads to ImageKit). */
export function useUploadWorkerDocument(workerId) {
  const invalidate = useInvalidateWorkerDocs(workerId);
  return useMutation({
    mutationFn: async ({ file, type }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      return unwrap(api.post(`/workers/${workerId}/documents`, formData));
    },
    onSuccess: invalidate
  });
}

/** Approve or reject one document; the worker is notified either way. */
export function useVerifyWorkerDocument(workerId) {
  const invalidate = useInvalidateWorkerDocs(workerId);
  return useMutation({
    mutationFn: async ({ docId, approve, rejectionReason }) =>
    unwrap(api.post(`/workers/${workerId}/documents/${docId}/verify`, { approve, rejectionReason })),
    onSuccess: invalidate
  });
}