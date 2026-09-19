import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => unwrap(api.get("/notifications?pageSize=30"))
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => unwrap(api.post(`/notifications/${id}/read`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] })
  });
}

export function useMyTickets() {
  return useQuery({
    queryKey: ["support", "tickets"],
    queryFn: async () => unwrap(api.get("/support/tickets"))
  });
}

export function useTicketMessages(ticketId) {
  return useQuery({
    queryKey: ["support", "messages", ticketId],
    queryFn: async () => unwrap(api.get(`/support/tickets/${ticketId}/messages`)),
    enabled: Boolean(ticketId)
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) =>
    unwrap(api.post("/support/tickets", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support", "tickets"] })
  });
}

export function usePostMessage(ticketId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => unwrap(api.post(`/support/tickets/${ticketId}/messages`, { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support", "messages", ticketId] })
  });
}