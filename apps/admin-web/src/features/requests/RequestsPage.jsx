import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, formatDate } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

export function RequestsPage() {
  const [tab, setTab] = useState("advances");
  const qc = useQueryClient();

  const { data: advances, isLoading: loadingAdv } = useQuery({
    queryKey: ["advances", { status: "REQUESTED" }],
    queryFn: async () => unwrap(api.get("/advances?status=REQUESTED")),
    enabled: tab === "advances"
  });

  const { data: kharchi, isLoading: loadingKh } = useQuery({
    queryKey: ["kharchi", { status: "REQUESTED" }],
    queryFn: async () => unwrap(api.get("/kharchi?status=REQUESTED")),
    enabled: tab === "kharchi"
  });

  useSocketInvalidate("advance:created", [["advances"]]);
  useSocketInvalidate("kharchi:created", [["kharchi"]]);

  const approveAdvance = useMutation({
    mutationFn: async ({ id, amountRupees }) =>
    unwrap(api.post(`/advances/${id}/approve`, { approvedAmountRupees: amountRupees })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advances"] })
  });
  const rejectAdvance = useMutation({
    mutationFn: async ({ id, reason }) =>
    unwrap(api.post(`/advances/${id}/reject`, { rejectionReason: reason })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advances"] })
  });

  const approveKharchi = useMutation({
    mutationFn: async (id) => unwrap(api.post(`/kharchi/${id}/approve`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kharchi"] })
  });
  const rejectKharchi = useMutation({
    mutationFn: async ({ id, reason }) =>
    unwrap(api.post(`/kharchi/${id}/reject`, { rejectionReason: reason })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kharchi"] })
  });

  const advanceColumns = [
  { header: "Employee ID", cell: (r) => r.worker?.employeeId },
  { header: "Amount", cell: (r) => formatINR(Math.round(r.amountPaise / 100)) },
  { header: "Reason", cell: (r) => r.reason, className: "font-body" },
  { header: "Requested", cell: (r) => formatDate(r.requestedDate) },
  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    header: "Actions",
    cell: (r) =>
    <div className="flex gap-2">
          <button
        className="btn-primary !px-2 !py-1 text-xs"
        onClick={() => approveAdvance.mutate({ id: r._id, amountRupees: Math.round(r.amountPaise / 100) })}>
        
            Approve
          </button>
          <button
        className="btn-ghost !px-2 !py-1 text-xs text-rust"
        onClick={() => {
          const reason = window.prompt("Rejection reason:");
          if (reason) rejectAdvance.mutate({ id: r._id, reason });
        }}>
        
            Reject
          </button>
        </div>

  }];

  const kharchiColumns = [
  { header: "Employee ID", cell: (r) => r.worker?.employeeId },
  { header: "Site", cell: (r) => r.site?.name, className: "font-body" },
  { header: "Category", cell: (r) => r.category, className: "font-body" },
  { header: "Amount", cell: (r) => formatINR(Math.round(r.amountPaise / 100)) },
  { header: "Date", cell: (r) => formatDate(r.date) },
  {
    header: "Actions",
    cell: (r) =>
    <div className="flex gap-2">
          <button className="btn-primary !px-2 !py-1 text-xs" onClick={() => approveKharchi.mutate(r._id)}>
            Approve
          </button>
          <button
        className="btn-ghost !px-2 !py-1 text-xs text-rust"
        onClick={() => {
          const reason = window.prompt("Rejection reason:");
          if (reason) rejectKharchi.mutate({ id: r._id, reason });
        }}>
        
            Reject
          </button>
        </div>

  }];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Advances & Kharchi</h1>
        <p className="text-sm text-graphite-500">Pending requests awaiting approval.</p>
      </div>

      <div className="flex rounded border border-steel-200 bg-surface p-0.5 w-fit">
        {["advances", "kharchi"].map((t) =>
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`rounded px-3 py-1.5 text-sm capitalize transition-colors duration-150 ${
          tab === t ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`
          }>
          
            {t}
          </button>
        )}
      </div>

      {tab === "advances" ?
      <DataTable
        columns={advanceColumns}
        rows={advances}
        isLoading={loadingAdv}
        emptyTitle="No pending advance requests"
        emptyBody="Advance requests from workers and managers will appear here." /> :

      <DataTable
        columns={kharchiColumns}
        rows={kharchi}
        isLoading={loadingKh}
        emptyTitle="No pending Kharchi requests"
        emptyBody="Kharchi requests from workers and managers will appear here." />

      }
    </div>);

}