import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";
import { formatDateTime } from "@/lib/format";

export function SupportPage() {
  const [activeTicket, setActiveTicket] = useState(null);
  const [reply, setReply] = useState("");
  const qc = useQueryClient();

  const { data: tickets } = useQuery({
    queryKey: ["support", "tickets"],
    queryFn: async () => unwrap(api.get("/support/tickets"))
  });

  const { data: messages } = useQuery({
    queryKey: ["support", "messages", activeTicket],
    queryFn: async () => unwrap(api.get(`/support/tickets/${activeTicket}/messages`)),
    enabled: Boolean(activeTicket)
  });

  useSocketInvalidate("chat:message", [["support", "tickets"], ["support", "messages", activeTicket ?? ""]]);

  const postMessage = useMutation({
    mutationFn: async () => unwrap(api.post(`/support/tickets/${activeTicket}/messages`, { body: reply })),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["support", "messages", activeTicket] });
    }
  });

  const setStatus = useMutation({
    mutationFn: async (status) => unwrap(api.patch(`/support/tickets/${activeTicket}/status`, { status })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support", "tickets"] })
  });

  const selected = tickets?.find((t) => t._id === activeTicket);

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-3 gap-4">
      <div className="card overflow-y-auto">
        <div className="border-b border-steel-200 px-4 py-2.5">
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Tickets</p>
        </div>
        {!tickets || tickets.length === 0 ?
        <p className="px-4 py-6 text-center text-sm text-graphite-500">No support tickets yet.</p> :

        <ul className="divide-y divide-steel-200">
            {tickets.map((t) =>
          <li
            key={t._id}
            onClick={() => setActiveTicket(t._id)}
            className={`cursor-pointer px-4 py-3 hover:bg-steel-100/40 ${activeTicket === t._id ? "bg-amber-50" : ""}`}>
            
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-graphite-900">{t.ticketNumber}</p>
                  <StatusBadge status={t.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-graphite-500">{t.subject}</p>
                <p className="text-[11px] text-graphite-300">{t.raisedBy?.name}</p>
              </li>
          )}
          </ul>
        }
      </div>

      <div className="card col-span-2 flex flex-col">
        {!selected ?
        <div className="flex flex-1 items-center justify-center text-sm text-graphite-500">
            Select a ticket to view the conversation.
          </div> :

        <>
            <div className="flex items-center justify-between border-b border-steel-200 px-4 py-2.5">
              <div>
                <p className="font-display text-sm font-semibold text-graphite-900">{selected.subject}</p>
                <p className="text-xs text-graphite-500">{selected.ticketNumber}</p>
              </div>
              <select
              className="input max-w-[9rem]"
              value={selected.status}
              onChange={(e) => setStatus.mutate(e.target.value)}>
              
                {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) =>
              <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
              )}
              </select>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages?.map((m) =>
            <div key={m._id} className="max-w-md rounded-md bg-steel-100/50 px-3 py-2">
                  <p className="text-xs font-medium text-graphite-900">
                    {m.sender?.name} <span className="text-graphite-300">· {formatDateTime(m.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-graphite-900">{m.body}</p>
                </div>
            )}
            </div>

            <form
            className="flex gap-2 border-t border-steel-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim()) postMessage.mutate();
            }}>
            
              <input
              className="input"
              placeholder="Type a reply…"
              value={reply}
              onChange={(e) => setReply(e.target.value)} />
            
              <button type="submit" className="btn-primary" disabled={postMessage.isPending}>
                Send
              </button>
            </form>
          </>
        }
      </div>
    </div>);

}