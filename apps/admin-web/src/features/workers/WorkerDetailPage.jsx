import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useWorker,
  useVerifyDocuments,
  useVerifyWorkType,
  useActivateWorker,
  useRejectWorker,
  useAssignSite,
  useSitesForSelect } from
"./api";
import { useAuthStore } from "@/stores/authStore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";
import { DirectAdvancePanel, DirectKharchiPanel } from "@/features/requests/DirectAddPanels";

const STEPS = ["PENDING_VERIFICATION", "DOCUMENT_VERIFIED", "WORK_TYPE_VERIFIED", "ACTIVE"];

export function WorkerDetailPage() {
  const { id } = useParams();
  const { data: worker, isLoading } = useWorker(id);
  const { data: sites } = useSitesForSelect();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [rejectReason, setRejectReason] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [quickAdd, setQuickAdd] = useState(null); // null | "advance" | "kharchi"

  const verifyDocuments = useVerifyDocuments();
  const verifyWorkType = useVerifyWorkType();
  const activate = useActivateWorker();
  const reject = useRejectWorker();
  const assignSite = useAssignSite();

  useSocketInvalidate("worker:verification_updated", [["workers", id ?? ""]]);
  useSocketInvalidate("worker:site_assigned", [["workers", id ?? ""]]);

  if (isLoading) return <p className="text-sm text-graphite-500">Loading…</p>;
  if (!worker) return <p className="text-sm text-graphite-500">Worker not found.</p>;

  const stepIndex = STEPS.indexOf(worker.verificationStatus);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-semibold text-graphite-900">{worker.user?.name}</h1>
          <StatusBadge status={worker.verificationStatus} />
        </div>
        <p className="text-sm text-graphite-500">
          {worker.employeeId} · {worker.user?.phone}
        </p>
      </div>

      {worker.verificationStatus !== "REJECTED" && worker.verificationStatus !== "ACTIVE" &&
      <div className="card p-4">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
            Verification progress
          </p>
          <ol className="mb-4 flex items-center gap-2 text-xs text-graphite-500">
            {STEPS.map((step, i) =>
          <li key={step} className="flex items-center gap-2">
                <span
              className={
              i <= stepIndex ?
              "flex h-5 w-5 items-center justify-center rounded-full bg-amber text-[10px] font-semibold text-white" :
              "flex h-5 w-5 items-center justify-center rounded-full bg-steel-100 text-[10px] font-semibold text-graphite-300"
              }>
              
                  {i + 1}
                </span>
                {step.replace(/_/g, " ")}
                {i < STEPS.length - 1 && <span className="mx-1 text-steel-200">—</span>}
              </li>
          )}
          </ol>

          <div className="flex flex-wrap gap-2">
            {worker.verificationStatus === "PENDING_VERIFICATION" &&
          <button className="btn-primary" onClick={() => verifyDocuments.mutate(worker._id)} disabled={verifyDocuments.isPending}>
                Verify documents
              </button>
          }
            {worker.verificationStatus === "DOCUMENT_VERIFIED" &&
          <button className="btn-primary" onClick={() => verifyWorkType.mutate(worker._id)} disabled={verifyWorkType.isPending}>
                Verify work type
              </button>
          }
            {worker.verificationStatus === "WORK_TYPE_VERIFIED" &&
          <button className="btn-accent" onClick={() => activate.mutate(worker._id)} disabled={activate.isPending}>
                Activate worker
              </button>
          }
          </div>

          <div className="mt-4 flex items-end gap-2 border-t border-steel-200 pt-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-graphite-500">Reject with reason</label>
              <input
              className="input"
              placeholder="e.g. Aadhaar photo unreadable, please re-upload"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)} />
            
            </div>
            <button
            className="btn-ghost text-rust"
            disabled={!rejectReason || reject.isPending}
            onClick={() => reject.mutate({ workerId: worker._id, reason: rejectReason })}>
            
              Reject
            </button>
          </div>
        </div>
      }

      {isSuperAdmin &&
      <div className="card p-4">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
            Add advance / Kharchi — Super Admin
          </p>
          <p className="mb-3 text-sm text-graphite-500">
            Record an advance or Kharchi directly on this worker&apos;s account. Amounts are
            approved instantly and flow into salary deductions and payroll totals.
          </p>
          <div className="flex gap-2">
            <button
          className={quickAdd === "advance" ? "btn-primary" : "btn-ghost"}
          onClick={() => setQuickAdd(quickAdd === "advance" ? null : "advance")}>
          
              Add advance
            </button>
            <button
          className={quickAdd === "kharchi" ? "btn-primary" : "btn-ghost"}
          onClick={() => setQuickAdd(quickAdd === "kharchi" ? null : "kharchi")}>
          
              Add kharchi
            </button>
          </div>
          {quickAdd === "advance" &&
        <div className="mt-4">
              <DirectAdvancePanel workers={[worker]} presetWorkerId={worker._id} />
            </div>
        }
          {quickAdd === "kharchi" &&
        <div className="mt-4">
              <DirectKharchiPanel
          workers={[worker]}
          presetWorkerId={worker._id}
          presetSiteId={worker.currentSite?._id} />
          
            </div>
        }
        </div>
      }

      <div className="card p-4">
        <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
          Site assignment
        </p>
        <p className="mb-3 text-sm text-graphite-900">
          Current site: <span className="font-medium">{worker.currentSite?.name ?? "Unassigned"}</span>
        </p>
        <div className="flex gap-2">
          <select className="input max-w-xs" value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
            <option value="">Select a site…</option>
            {sites?.map((s) =>
            <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            )}
          </select>
          <button
            className="btn-primary"
            disabled={!selectedSite || assignSite.isPending}
            onClick={() => assignSite.mutate({ workerId: worker._id, siteId: selectedSite })}>
            
            Assign
          </button>
        </div>
      </div>

      <div className="card p-4">
        <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
          Work details
        </p>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-graphite-500">Work type</dt>
            <dd className="font-medium text-graphite-900">{worker.workType?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Registered</dt>
            <dd className="font-medium text-graphite-900">{new Date(worker.createdAt).toLocaleDateString("en-IN")}</dd>
          </div>
        </dl>
      </div>
    </div>);

}