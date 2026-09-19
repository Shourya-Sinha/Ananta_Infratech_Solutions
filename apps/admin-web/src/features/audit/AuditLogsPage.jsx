import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { formatDateTime } from "@/lib/format";

export function AuditLogsPage() {
  const [targetType, setTargetType] = useState("");
  const qs = targetType ? `?targetType=${targetType}` : "";

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", targetType],
    queryFn: async () => unwrap(api.get(`/audit-logs${qs}`))
  });

  const columns = [
  { header: "Time", cell: (l) => formatDateTime(l.createdAt) },
  { header: "Actor", cell: (l) => l.actor?.name ?? "—", className: "font-body" },
  { header: "Action", cell: (l) => l.action.replace(/_/g, " ") },
  { header: "Target", cell: (l) => `${l.targetType} · ${l.targetId.slice(-6)}`, className: "font-body text-graphite-500" }];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Audit Logs</h1>
        <p className="text-sm text-graphite-500">{data?.total ?? 0} recorded events</p>
      </div>

      <select className="input max-w-xs" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
        <option value="">All target types</option>
        {["User", "WorkerProfile", "Site", "Attendance", "AdvanceRequest", "KharchiRequest", "FinancialTransaction", "Role"].map(
          (t) =>
          <option key={t} value={t}>
              {t}
            </option>

        )}
      </select>

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        emptyTitle="No audit events"
        emptyBody="Every sensitive operation in the system will be logged here." />
      
    </div>);

}