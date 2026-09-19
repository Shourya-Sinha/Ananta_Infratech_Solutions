import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { useWorkers } from "@/features/workers/api";
import { useAdvances, useKharchi, useMarkAdvancePaid } from "./api";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, formatDate } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";
import { DirectAdvancePanel, DirectKharchiPanel } from "./DirectAddPanels";

const toRupees = (paise) => Math.round(paise / 100);

export function RequestsPage() {
  const [tab, setTab] = useState("advances");
  // Pending = worker/manager-initiated requests awaiting action.
  // All = every entry incl. Super Admin direct adds (APPROVED/PAID history).
  const [scope, setScope] = useState("REQUESTED");
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const qc = useQueryClient();

  const status = scope === "ALL" ? undefined : scope;
  const { data: advances, isLoading: loadingAdv } = useAdvances(status, { enabled: tab === "advances" });
  const { data: kharchi, isLoading: loadingKh } = useKharchi(status, { enabled: tab === "kharchi" });

  const { data: workersData } = useWorkers({}, isSuperAdmin);
  const workers = workersData?.items;

  useSocketInvalidate("advance:created", [["advances"]]);
  useSocketInvalidate("advance:approved", [["advances"]]);
  useSocketInvalidate("advance:paid", [["advances"]]);
  useSocketInvalidate("kharchi:created", [["kharchi"]]);
  useSocketInvalidate("kharchi:approved", [["kharchi"]]);

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
  const markAdvancePaid = useMarkAdvancePaid();

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
  { header: "Amount", cell: (r) => formatINR(toRupees(r.amountPaise)) },
  {
    header: "Approved",
    cell: (r) => (r.approvedAmountPaise != null ? formatINR(toRupees(r.approvedAmountPaise)) : "—")
  },
  { header: "Reason", cell: (r) =>
    <span className="font-body">
        {r.reason}
        {r.isDirect &&
      <span className="badge ml-2 bg-amber-50 text-amber-600">Direct</span>
      }
      </span>,

    className: "font-body"
  },
  { header: "Requested", cell: (r) => formatDate(r.requestedDate) },
  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    header: "Actions",
    cell: (r) =>
    <div className="flex gap-2">
          {r.status === "REQUESTED" &&
      <button
        className="btn-primary !px-2 !py-1 text-xs"
        onClick={() => approveAdvance.mutate({ id: r._id, amountRupees: toRupees(r.amountPaise) })}>
        
            Approve
          </button>
      }
          {(r.status === "APPROVED" || r.status === "PARTIALLY_APPROVED") &&
      <button
        className="btn-accent !px-2 !py-1 text-xs"
        disabled={markAdvancePaid.isPending}
        onClick={() => markAdvancePaid.mutate({ id: r._id })}>
        
            Mark paid
          </button>
      }
          {r.status === "REQUESTED" &&
      <button
        className="btn-ghost !px-2 !py-1 text-xs text-rust"
        onClick={() => {
          const reason = window.prompt("Rejection reason:");
          if (reason) rejectAdvance.mutate({ id: r._id, reason });
        }}>
        
            Reject
          </button>
      }
        </div>
  }];

  const kharchiColumns = [
  { header: "Employee ID", cell: (r) => r.worker?.employeeId },
  { header: "Site", cell: (r) => r.site?.name, className: "font-body" },
  { header: "Category", cell: (r) =>
    <span className="font-body">
        {r.category}
        {r.isDirect &&
      <span className="badge ml-2 bg-amber-50 text-amber-600">Direct</span>
      }
      </span>
  },
  { header: "Amount", cell: (r) => formatINR(toRupees(r.amountPaise)) },
  { header: "Date", cell: (r) => formatDate(r.date) },
  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    header: "Actions",
    cell: (r) =>
    r.status === "REQUESTED" ?
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
        </div> :

    <span className="text-xs text-graphite-500">—</span>

  }];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Advances & Kharchi</h1>
        <p className="text-sm text-graphite-500">
          Pending requests awaiting approval{isSuperAdmin ? ", plus Super Admin direct adds." : "."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded border border-steel-200 bg-surface p-0.5 w-fit">
          {["advances", "kharchi"].map((t) =>
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm capitalize transition-colors duration-150 ${
            tab === t ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`}>
            
              {t}
            </button>
          )}
        </div>

        <div className="flex rounded border border-steel-200 bg-surface p-0.5 w-fit">
          {[["REQUESTED", "Pending"], ["ALL", "All"]].map(([value, label]) =>
          <button
            key={value}
            onClick={() => setScope(value)}
            className={`rounded px-3 py-1.5 text-sm transition-colors duration-150 ${
            scope === value ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`}>
            
              {label}
            </button>
          )}
        </div>
      </div>

      {isSuperAdmin &&
      <div className="space-y-4">
          {tab === "advances" ?
        <DirectAdvancePanel workers={workers} /> :

        <DirectKharchiPanel workers={workers} />
        }
        </div>
      }

      {tab === "advances" ?
      <DataTable
        columns={advanceColumns}
        rows={advances}
        isLoading={loadingAdv}
        emptyTitle={scope === "REQUESTED" ? "No pending advance requests" : "No advance entries"}
        emptyBody="Advance requests from workers and managers will appear here." /> :

      <DataTable
        columns={kharchiColumns}
        rows={kharchi}
        isLoading={loadingKh}
        emptyTitle={scope === "REQUESTED" ? "No pending Kharchi requests" : "No Kharchi entries"}
        emptyBody="Kharchi requests from workers and managers will appear here." />

      }
    </div>);

}
