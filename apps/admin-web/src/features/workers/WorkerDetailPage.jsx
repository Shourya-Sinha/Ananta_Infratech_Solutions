import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useWorker,
  useVerifyDocuments,
  useVerifyWorkType,
  useActivateWorker,
  useRejectWorker,
  useAssignSite,
  useSitesForSelect,
  useWorkTypes,
  useChangeWorkType,
  useAssignmentHistory,
} from "./api";
import { useAuthStore } from "@/stores/authStore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataDisplay";
import { useToast } from "@/components/ui/Toast";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";
import { DirectAdvancePanel, DirectKharchiPanel } from "@/features/requests/DirectAddPanels";
import { WorkerDocumentsCard } from "./WorkerDocumentsCard";
import { formatDate } from "@/lib/format";

const STEPS = ["PENDING_VERIFICATION", "DOCUMENT_VERIFIED", "WORK_TYPE_VERIFIED", "ACTIVE"];

export function WorkerDetailPage() {
  const { id } = useParams();
  const { data: worker, isLoading } = useWorker(id);
  const { data: sites } = useSitesForSelect();
  const { data: workTypes } = useWorkTypes();
  const { data: assignments } = useAssignmentHistory(id);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const toast = useToast();
  const [rejectReason, setRejectReason] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedWorkType, setSelectedWorkType] = useState("");
  const [quickAdd, setQuickAdd] = useState(null);

  const verifyDocuments = useVerifyDocuments();
  const verifyWorkType = useVerifyWorkType();
  const activate = useActivateWorker();
  const reject = useRejectWorker();
  const assignSite = useAssignSite();
  const changeWorkType = useChangeWorkType();

  useSocketInvalidate("worker:verification_updated", [["workers", id ?? ""]]);
  useSocketInvalidate("worker:site_assigned", [["workers", id ?? ""]]);
  useSocketInvalidate("worker:work_type_updated", [["workers", id ?? ""]]);

  if (isLoading) return <p className="text-sm text-graphite-500">Loading…</p>;
  if (!worker) return <p className="text-sm text-graphite-500">Worker not found.</p>;

  const stepIndex = STEPS.indexOf(worker.verificationStatus);

  const handleChangeWorkType = () => {
    if (!selectedWorkType) {
      toast.error("Select a work type first.");
      return;
    }
    changeWorkType.mutate(
      { workerId: worker._id, workTypeId: selectedWorkType },
      {
        onSuccess: () => toast.success("Work type changed. Salary rate updated for future attendance."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change work type."),
      },
    );
  };

  const assignmentColumns = [
    { header: "Site", cell: (a) => a.site?.name ?? a.site ?? "—", className: "font-body" },
    { header: "From", cell: (a) => (a.from ? formatDate(a.from) : "—") },
    { header: "To", cell: (a) => (a.to ? formatDate(a.to) : "Present") },
    { header: "Status", cell: (a) => <StatusBadge status={a.status ?? "ACTIVE"} /> },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-semibold text-graphite-900">{worker.user?.name}</h1>
          <StatusBadge status={worker.verificationStatus} />
        </div>
        <p className="text-sm text-graphite-500">
          {worker.employeeId} · {worker.user?.phone} {worker.user?.email ? `· ${worker.user.email}` : ""}
        </p>
      </div>

      {worker.verificationStatus !== "REJECTED" && worker.verificationStatus !== "ACTIVE" && (
        <div className="card p-4">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Verification progress</p>
          <ol className="mb-4 flex items-center gap-2 text-xs text-graphite-500">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className={i <= stepIndex ? "flex h-5 w-5 items-center justify-center rounded-full bg-amber text-[10px] font-semibold text-white" : "flex h-5 w-5 items-center justify-center rounded-full bg-steel-100 text-[10px] font-semibold text-graphite-300"}>
                  {i + 1}
                </span>
                {step.replace(/_/g, " ")}
                {i < STEPS.length - 1 && <span className="mx-1 text-steel-200">—</span>}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            {worker.verificationStatus === "PENDING_VERIFICATION" && (
              <button className="btn-primary" onClick={() => verifyDocuments.mutate(worker._id)} disabled={verifyDocuments.isPending}>
                Verify documents
              </button>
            )}
            {worker.verificationStatus === "DOCUMENT_VERIFIED" && (
              <button className="btn-primary" onClick={() => verifyWorkType.mutate(worker._id)} disabled={verifyWorkType.isPending}>
                Verify work type
              </button>
            )}
            {worker.verificationStatus === "WORK_TYPE_VERIFIED" && (
              <button className="btn-accent" onClick={() => activate.mutate(worker._id)} disabled={activate.isPending}>
                Activate worker
              </button>
            )}
          </div>

          <div className="mt-4 flex items-end gap-2 border-t border-steel-200 pt-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-graphite-500">Reject with reason</label>
              <input className="input" placeholder="e.g. Aadhaar photo unreadable, please re-upload" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
            <button className="btn-ghost text-rust" disabled={!rejectReason || reject.isPending} onClick={() => reject.mutate({ workerId: worker._id, reason: rejectReason })}>
              Reject
            </button>
          </div>
        </div>
      )}

      <WorkerDocumentsCard workerId={worker._id} verificationStatus={worker.verificationStatus} />

      {isSuperAdmin && (
        <div className="card p-4">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Add advance / Kharchi — Super Admin</p>
          <p className="mb-3 text-sm text-graphite-500">Record an advance or Kharchi directly on this worker&apos;s account. Amounts are approved instantly and flow into salary deductions and payroll totals.</p>
          <div className="flex gap-2">
            <button className={quickAdd === "advance" ? "btn-primary" : "btn-ghost"} onClick={() => setQuickAdd(quickAdd === "advance" ? null : "advance")}>
              Add advance
            </button>
            <button className={quickAdd === "kharchi" ? "btn-primary" : "btn-ghost"} onClick={() => setQuickAdd(quickAdd === "kharchi" ? null : "kharchi")}>
              Add kharchi
            </button>
          </div>
          {quickAdd === "advance" && (
            <div className="mt-4">
              <DirectAdvancePanel workers={[worker]} presetWorkerId={worker._id} />
            </div>
          )}
          {quickAdd === "kharchi" && (
            <div className="mt-4">
              <DirectKharchiPanel workers={[worker]} presetWorkerId={worker._id} presetSiteId={worker.currentSite?._id} />
            </div>
          )}
        </div>
      )}

      <div className="card p-4">
        <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Site assignment</p>
        <p className="mb-3 text-sm text-graphite-900">
          Current site: <span className="font-medium">{worker.currentSite?.name ?? "Unassigned"}</span>
          {worker.currentSite?.code ? <span className="text-xs text-graphite-500"> ({worker.currentSite.code})</span> : null}
        </p>
        <div className="flex gap-2">
          <select className="input max-w-xs" value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
            <option value="">Select a site…</option>
            {sites?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={!selectedSite || assignSite.isPending}
            onClick={() =>
              assignSite.mutate(
                { workerId: worker._id, siteId: selectedSite },
                {
                  onSuccess: () => toast.success("Site assigned. Worker notified."),
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Assignment failed."),
                },
              )
            }
          >
            Assign
          </button>
        </div>
        {assignments && assignments.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-graphite-500">Assignment history</p>
            <DataTable columns={assignmentColumns} rows={assignments} isLoading={false} emptyTitle="No history" emptyBody="No past assignments." />
          </div>
        )}
      </div>

      <div className="card p-4">
        <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Work details & change work type</p>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-graphite-500">Work type</dt>
            <dd className="font-medium text-graphite-900">{worker.workType?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Daily rate</dt>
            <dd className="font-mono font-medium text-graphite-900">{worker.workType?.defaultDailyRatePaise != null ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(worker.workType.defaultDailyRatePaise / 100) + "/day" : "—"}</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Registered</dt>
            <dd className="font-medium text-graphite-900">{new Date(worker.createdAt).toLocaleDateString("en-IN")}</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Status</dt>
            <dd>
              <StatusBadge status={worker.verificationStatus} />
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-steel-200 pt-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-graphite-500">Change work type (worker.changeWorkType)</label>
            <select className="input" value={selectedWorkType} onChange={(e) => setSelectedWorkType(e.target.value)}>
              <option value="">Select new work type…</option>
              {workTypes?.map((wt) => (
                <option key={wt._id} value={wt._id} disabled={!wt.isActive}>
                  {wt.name} — {wt.code}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-accent" disabled={!selectedWorkType || changeWorkType.isPending} onClick={handleChangeWorkType}>
            {changeWorkType.isPending ? "Saving…" : "Change work type"}
          </button>
        </div>
        <p className="mt-2 text-xs text-graphite-500">Requires <code>worker.changeWorkType</code> permission (Super Admin has it). Future attendance will use the new daily rate.</p>
      </div>
    </div>
  );
}
