import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export function useAnnouncements() {
  return useQuery({ queryKey: ["company", "announcements"], queryFn: async () => unwrap(api.get("/company/announcements")), staleTime: 60_000 });
}
export function useManageAnnouncements(enabled = true) {
  return useQuery({ queryKey: ["company", "announcements-manage"], queryFn: async () => unwrap(api.get("/company/announcements/manage")), enabled });
}
export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => unwrap(api.post("/company/announcements", input)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company", "announcements"] }); qc.invalidateQueries({ queryKey: ["company", "announcements-manage"] }); }
  });
}
export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => unwrap(api.delete(`/company/announcements/${id}`)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company", "announcements"] }); qc.invalidateQueries({ queryKey: ["company", "announcements-manage"] }); }
  });
}
export function useHolidays(from, to) {
  return useQuery({
    queryKey: ["company", "holidays", from, to],
    queryFn: async () => unwrap(api.get(`/company/holidays?from=${from}&to=${to}`)),
    staleTime: 300_000
  });
}
export function useMyLeaves() {
  return useQuery({ queryKey: ["company", "leaves"], queryFn: async () => unwrap(api.get("/company/leaves")) });
}
export function useRequestLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => unwrap(api.post("/company/leaves", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company", "leaves"] })
  });
}
export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => unwrap(api.post(`/company/leaves/${id}/cancel`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company", "leaves"] })
  });
}
export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve, note }) => unwrap(api.post(`/company/leaves/${id}/decide`, { approve, note })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "leaves"] });
      qc.invalidateQueries({ queryKey: ["manager", "attendance"] });
      qc.invalidateQueries({ queryKey: ["worker", "statement"] });
    }
  });
}
