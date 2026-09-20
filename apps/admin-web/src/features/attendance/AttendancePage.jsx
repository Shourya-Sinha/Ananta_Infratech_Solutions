import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/format";

const STATUSES = ["PRESENT", "HALF_DAY", "LEAVE_PAID", "ABSENT", "LEAVE_UNPAID", "CUSTOM"];
// Sensible hours defaults when switching status (admin can override per row).
const DEFAULT_HOURS = { PRESENT: 8, HALF_DAY: 4, LEAVE_PAID: 8, ABSENT: 0, LEAVE_UNPAID: 0, CUSTOM: 8 };
const today = () => new Date().toISOString().slice(0, 10);

function useSitesForSelect() {
  return useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites"))
  });
}

function useSiteWorkers(site) {
  return useQuery({
    queryKey: ["workers", { site }],
    queryFn: async () => unwrap(api.get(`/workers?site=${site}&pageSize=100`)),
    enabled: Boolean(site)
  });
}

function useAttendance(filters) {
  const qs = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ["attendance", filters],
    queryFn: async () => unwrap(api.get(`/attendance?${qs}`)),
    enabled: Boolean(filters.site && filters.from && filters.to)
  });
}

const rowKey = (w) => w._id;

export function AttendancePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [site, setSite] = useState("");
  const [date, setDate] = useState(today());

  const { data: sites } = useSitesForSelect();
  const { data: workers } = useSiteWorkers(site);
  const { data, isLoading } = useAttendance(site ? { site, from: date, to: date } : {});
  useSocketInvalidate("attendance:created", [["attendance"]]);
  useSocketInvalidate("attendance:updated", [["attendance"]]);
  useSocketInvalidate("attendance:deleted", [["attendance"]]);
  useSocketInvalidate("attendance:deleted", [["payroll"]]);
  useSocketInvalidate("salary:ledger_updated", [["payroll"]]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["attendance"] });
    qc.invalidateQueries({ queryKey: ["payroll"] });
  };

  // Effective record per worker: after a correction both the original and
  // the correction record exist — show only the newest one per worker.
  const effectiveRows = useMemo(() => {
    const latest = new Map();
    (data ?? []).forEach((a) => {
      const id = String(a.worker?._id ?? a.worker ?? "");
      if (!id) return;
      const current = latest.get(id);
      if (!current || new Date(a.createdAt) > new Date(current.createdAt)) latest.set(id, a);
    });
    return [...latest.values()];
  }, [data]);

  // Rows already marked for this date, keyed by worker profile id.
  const markedByWorker = useMemo(() => {
    const map = new Map();
    effectiveRows.forEach((a) => {
      const id = a.worker?._id ?? a.worker;
      if (id) map.set(String(id), a);
    });
    return map;
  }, [effectiveRows]);

  const activeWorkers = (workers ?? []).filter((w) => w.verificationStatus === "ACTIVE");
  const unmarked = activeWorkers.filter((w) => !markedByWorker.has(String(w._id)));

  // --- Mark (create) ------------------------------------------------------
  const [drafts, setDrafts] = useState({});
  const draftFor = (workerId) =>
  drafts[workerId] ?? { status: "PRESENT", hoursWorked: 8, overtimeHours: 0 };
  const setDraft = (workerId, patch) =>
  setDrafts((d) => ({ ...d, [workerId]: { ...draftFor(workerId), ...patch } }));

  const mark = useMutation({
    mutationFn: async ({ worker, status, hoursWorked, overtimeHours, name }) => {
      await unwrap(
        api.post("/attendance", { worker, site, date, status, hoursWorked, overtimeHours })
      );
      return name;
    },
    onSuccess: (name) => {
      invalidate();
      toast.success(`Attendance recorded for ${name} on ${formatDate(date)}. Salary posting updated.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not record attendance.")
  });

  const markAllPresent = useMutation({
    mutationFn: async () =>
    unwrap(
      api.post("/attendance/bulk", {
        site,
        date,
        entries: unmarked.map((w) => ({
          worker: w._id,
          status: "PRESENT",
          hoursWorked: 8,
          overtimeHours: 0
        }))
      })
    ),
    onSuccess: (results) => {
      invalidate();
      const ok = (results ?? []).filter((r) => r.success).length;
      const failed = (results ?? []).length - ok;
      if (failed === 0) {
        toast.success(`Marked ${ok} worker(s) PRESENT for ${formatDate(date)}.`);
      } else {
        toast.info(`${ok} marked, ${failed} failed (e.g. already marked or not verified).`);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Bulk marking failed.")
  });

  // --- Edit (correction — re-runs salary with reversal of the old posting) ---
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ status: "PRESENT", hoursWorked: 8, overtimeHours: 0, reason: "" });

  const startEdit = (a) => {
    setEditingId(a._id);
    setEditForm({ status: a.status, hoursWorked: a.hoursWorked ?? 0, overtimeHours: a.overtimeHours ?? 0, reason: "" });
  };

  const correct = useMutation({
    mutationFn: async () =>
    unwrap(
      api.patch("/attendance/correction", {
        correctionOf: editingId,
        status: editForm.status,
        hoursWorked: Number(editForm.hoursWorked),
        overtimeHours: Number(editForm.overtimeHours),
        reason: editForm.reason
      })
    ),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast.success("Attendance corrected. The old salary posting was reversed and recalculated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Correction failed.")
  });

  // --- Delete -------------------------------------------------------------
  const remove = useMutation({
    mutationFn: async (attendanceId) => unwrap(api.delete(`/attendance/${attendanceId}`)),
    onSuccess: (result) => {
      invalidate();
      toast.success(
        `Attendance deleted. ${result?.reversedLedgerEntries ?? 0} salary ledger entr${(result?.reversedLedgerEntries ?? 0) === 1 ? "y reversed" : "ies reversed"} and payroll recalculated.`
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed.")
  });

  const confirmDelete = (a) => {
    const name = a.worker?.user?.name ?? a.worker?.employeeId ?? "this worker";
    if (window.confirm(`Delete the ${a.status} attendance of ${name} for ${formatDate(a.date)}? The salary posting for that day will be reversed.`)) {
      remove.mutate(a._id);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Attendance</h1>
        <p className="text-sm text-graphite-500">
          Mark, correct, or delete attendance for any site as admin — every change instantly
          recalculates the worker&apos;s salary. Managers mark from the mobile app; this view has full control.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="input max-w-xs" value={site} onChange={(e) => setSite(e.target.value)}>
          <option value="">Select a site…</option>
          {sites?.map((s) =>
          <option key={s._id} value={s._id}>
              {s.name} ({s.code})
            </option>
          )}
        </select>
        <input type="date" className="input max-w-xs" value={date} onChange={(e) => setDate(e.target.value)} />
        {site &&
        unmarked.length > 0 &&
        <button
          className="btn-accent ml-auto"
          onClick={() => markAllPresent.mutate()}
          disabled={markAllPresent.isPending}>

            {markAllPresent.isPending ? "Marking…" : `Mark all ${unmarked.length} remaining PRESENT`}
          </button>
        }
      </div>

      {!site ?
      <p className="rounded border border-dashed border-steel-200 p-6 text-center text-sm text-graphite-500">
          Select a site to manage attendance for {formatDate(date)}.
        </p> :

      <>
        {/* ---- Not yet marked ---- */}
        <div>
          <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
            Not marked yet — {unmarked.length} active worker{unmarked.length === 1 ? "" : "s"} on this site
          </p>
          {activeWorkers.length === 0 ?
          <p className="rounded border border-dashed border-steel-200 p-4 text-center text-sm text-graphite-500">
              No ACTIVE workers are currently assigned to this site.
            </p> :
          unmarked.length === 0 ?
          <p className="rounded border border-dashed border-steel-200 p-4 text-center text-sm text-graphite-500">
              All active workers are marked for {formatDate(date)}. ✓
            </p> :

          <div className="card divide-y divide-steel-200">
              {unmarked.map((w) => {
              const d = draftFor(rowKey(w));
              return (
                <div key={w._id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <div className="min-w-44 flex-1">
                    <p className="text-sm font-medium text-graphite-900">{w.user?.name ?? "Unnamed"}</p>
                    <p className="font-mono text-xs text-graphite-500">{w.employeeId}</p>
                  </div>
                  <select
                    className="input w-36"
                    value={d.status}
                    onChange={(e) =>
                    setDraft(w._id, {
                      status: e.target.value,
                      hoursWorked: DEFAULT_HOURS[e.target.value] ?? 0
                    })}>


                    {STATUSES.map((s) =>
                    <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    )}
                  </select>
                  <input
                    className="input w-20"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    title="Hours worked"
                    value={d.hoursWorked}
                    onChange={(e) => setDraft(w._id, { hoursWorked: e.target.value })} />

                  <input
                    className="input w-20"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    title="Overtime hours"
                    value={d.overtimeHours}
                    onChange={(e) => setDraft(w._id, { overtimeHours: e.target.value })} />

                  <button
                    className="btn-primary"
                    disabled={mark.isPending}
                    onClick={() =>
                    mark.mutate({
                      worker: w._id,
                      status: d.status,
                      hoursWorked: Number(d.hoursWorked),
                      overtimeHours: Number(d.overtimeHours),
                      name: w.user?.name ?? w.employeeId
                    })}>


                    {mark.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              );
            })}
            </div>
          }
        </div>

        {/* ---- Marked records (edit / delete) ---- */}
        <div>
          <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
            Marked for {formatDate(date)}
          </p>
          {editingId &&
          <div className="mb-2 rounded border border-amber bg-amber-50 p-3">
              <p className="mb-2 font-display text-sm font-semibold text-amber-600">Editing attendance record</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                className="input w-36"
                value={editForm.status}
                onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  status: e.target.value,
                  hoursWorked: DEFAULT_HOURS[e.target.value] ?? f.hoursWorked
                }))}>


                  {STATUSES.map((s) =>
                <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                )}
                </select>
                <input
                className="input w-20"
                type="number"
                min="0"
                max="24"
                step="0.5"
                title="Hours worked"
                value={editForm.hoursWorked}
                onChange={(e) => setEditForm((f) => ({ ...f, hoursWorked: e.target.value }))} />

                <input
                className="input w-20"
                type="number"
                min="0"
                max="24"
                step="0.5"
                title="Overtime hours"
                value={editForm.overtimeHours}
                onChange={(e) => setEditForm((f) => ({ ...f, overtimeHours: e.target.value }))} />

                <input
                className="input max-w-xs flex-1"
                placeholder="Reason for correction (required) — e.g. wrongly marked absent"
                value={editForm.reason}
                onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))} />

                <button
                className="btn-primary"
                disabled={correct.isPending}
                onClick={() => {
                  if (editForm.reason.trim().length < 5) {
                    toast.error("A correction reason (min 5 characters) is required.");
                    return;
                  }
                  correct.mutate();
                }}>

                  {correct.isPending ? "Saving…" : "Save correction"}
                </button>
                <button className="btn-ghost" onClick={() => setEditingId(null)} disabled={correct.isPending}>
                  Cancel
                </button>
              </div>
              <p className="mt-1.5 text-xs text-graphite-500">
                The original salary posting is reversed and replaced by the corrected one — no double counting.
              </p>
            </div>
          }

          <DataTable
            columns={[
            { header: "Employee ID", cell: (a) => a.worker?.employeeId },
            {
              header: "Worker",
              cell: (a) => a.worker?.user?.name ?? "—",
              className: "font-body"
            },
            { header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
            { header: "Hours", cell: (a) => a.hoursWorked },
            { header: "Overtime", cell: (a) => a.overtimeHours },
            {
              header: "Actions",
              cell: (a) =>
              a.locked ?
              <span className="inline-flex items-center gap-1 text-xs text-graphite-300" title="Payroll month finalized — record locked">
                  <Lock size={13} /> Locked
                </span> :

              <span className="flex items-center gap-3">
                  <button
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline"
                  onClick={() => startEdit(a)}>

                    <Pencil size={13} /> Edit
                  </button>
                  <button
                  className={cx(
                    "inline-flex items-center gap-1 text-xs font-medium text-rust hover:underline",
                    remove.isPending && "opacity-50"
                  )}
                  onClick={() => confirmDelete(a)}
                  disabled={remove.isPending}>

                    <Trash2 size={13} /> Delete
                  </button>
                </span>
            }]}
            rows={effectiveRows}
            isLoading={isLoading}
            emptyTitle="No attendance recorded"
            emptyBody={`Nobody is marked for this site on ${formatDate(date)} yet — mark workers above.`} />

        </div>

        <p className="text-xs text-graphite-500">
          Salary rules: PRESENT/LEAVE_PAID credit a full day, HALF_DAY is pro-rated from hours, hours beyond
          the overtime threshold earn the overtime multiplier; ABSENT/LEAVE_UNPAID earn nothing. Corrections
          and deletions reverse the affected ledger entries first, so payroll is recalculated with no double counting.
        </p>
      </>
      }
    </div>);

}