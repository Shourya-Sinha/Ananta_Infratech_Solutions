import { useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";
import { formatDateTime, cx } from "@/lib/format";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
    unwrap(api.get("/notifications?pageSize=15"))
  });

  useSocketInvalidate("notification:new", [["notifications"]]);

  const markRead = useMutation({
    mutationFn: async (id) => unwrap(api.post(`/notifications/${id}/read`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] })
  });

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button
        className="relative rounded p-2 text-graphite-500 hover:bg-steel-100 transition-colors duration-150"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications">
        
        <Bell size={18} />
        {unreadCount > 0 &&
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rust px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        }
      </button>

      {open &&
      <div className="absolute right-0 z-20 mt-2 w-80 card max-h-96 overflow-y-auto">
          <div className="border-b border-steel-200 px-4 py-2.5">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
              Notifications
            </p>
          </div>
          {!data || data.items.length === 0 ?
        <p className="px-4 py-6 text-center text-sm text-graphite-500">No notifications yet.</p> :

        <ul className="divide-y divide-steel-200">
              {data.items.map((n) =>
          <li
            key={n._id}
            className={cx("cursor-pointer px-4 py-3 hover:bg-steel-100/40", !n.read && "bg-amber-50/40")}
            onClick={() => !n.read && markRead.mutate(n._id)}>
            
                  <p className="text-sm font-medium text-graphite-900">{n.title}</p>
                  <p className="mt-0.5 text-xs text-graphite-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-graphite-300">{formatDateTime(n.createdAt)}</p>
                </li>
          )}
            </ul>
        }
        </div>
      }
    </div>);

}