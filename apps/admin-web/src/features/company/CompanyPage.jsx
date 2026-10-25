import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Admin control for the mobile app's company features:
 * announcements (notice board), company holidays, and leave approvals.
 * Everything published here appears in the worker/manager apps.
 */
export function CompanyPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["company"] });

  const { data: announcements } = useQuery({ queryKey: ["company", "announcements"], queryFn: async () => unwrap(api.get("/company/announcements/manage")) });
  const { data: holidays } = useQuery({ queryKey: ["company", "holidays"], queryFn: async () => unwrap(api.get("/company/holidays")) });
  const { data: leaves } = useQuery({ queryKey: ["company", "leaves"], queryFn: async () => unwrap(api.get("/company/leaves")) });

  const [notice, setNotice] = useState({ title: "", body: "", audience: "ALL", pinned: false });
  const [holiday, setHoliday] = useState({ name: "", date: today(), note: "" });

  const createNotice = useMutation({
    mutationFn: async () => unwrap(api.post("/company/announcements", notice)),
    onSuccess: () => { invalidate(); setNotice({ title: "", body: "", audience: "ALL", pinned: false }); toast.success("Announcement published to the app."); },
    onError: (e) => toast.error(e.message)
  });
  const deleteNotice = useMutation({
    mutationFn: async (id) => unwrap(api.delete(`/company/announcements/${id}`)),
    onSuccess: () => { invalidate(); toast.success("Announcement deleted."); },
    onError: (e) => toast.error(e.message)
  });
  const createHoliday = useMutation({
    mutationFn: async () => unwrap(api.post("/company/holidays", holiday)),
    onSuccess: () => { invalidate(); setHoliday({ name: "", date: today(), note: "" }); toast.success("Holiday added."); },
    onError: (e) => toast.error(e.message)
  });
  const deleteHoliday = useMutation({
    mutationFn: async (id) => unwrap(api.delete(`/company/holidays/${id}`)),
    onSuccess: () => { invalidate(); toast.success("Holiday removed."); },
    onError: (e) => toast.error(e.message)
  });
  const decideLeave = useMutation({
    mutationFn: async ({ id, approve }) => unwrap(api.post(`/company/leaves/${id}/decide`, { approve })),
    onSuccess: (d) => { invalidate(); toast.success(d.status === "APPROVED" ? `Leave approved — attendance created for ${d.attendanceCreated} day(s).` : "Leave rejected."); },
    onError: (e) => toast.error(e.message)
  });

  const pendingLeaves = (leaves ?? []).filter((l) => l.status === "REQUESTED");
  const decidedLeaves = (leaves ?? []).filter((l) => l.status !== "REQUESTED").slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Company & App Control</h1>
        <p className="text-sm text-graphite-500">Announcements, holidays and leave — what you set here appears in the mobile app for workers & managers.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Announcements */}
        <div className="card space-y-3 p-5">
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">New announcement</p>
          <input className="input" placeholder="Title e.g. Holiday on 15 Aug" value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} />
          <textarea className="input" rows={3} placeholder="Message for the team…" value={notice.body} onChange={(e) => setNotice({ ...notice, body: e.target.value })} />
          <div className="flex flex-wrap items-center gap-3">
            <select className="input max-w-[170px]" value={notice.audience} onChange={(e) => setNotice({ ...notice, audience: e.target.value })}>
              <option value="ALL">Everyone</option><option value="WORKERS">Workers only</option><option value="MANAGERS">Managers only</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-graphite-700"><input type="checkbox" checked={notice.pinned} onChange={(e) => setNotice({ ...notice, pinned: e.target.checked })} /> Pin to top</label>
            <button className="btn-accent ml-auto" disabled={createNotice.isPending || notice.title.length < 3 || notice.body.length < 3} onClick={() => createNotice.mutate()}>Publish</button>
          </div>
          <div className="divide-y divide-steel-100">
            {(announcements ?? []).map((a) => (
              <div key={a._id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-graphite-900">{a.pinned ? "📌 " : ""}{a.title}</p>
                  <p className="line-clamp-2 text-xs text-graphite-500">{a.body}</p>
                  <p className="mt-1 text-[11px] text-graphite-400">{formatDate(a.createdAt)} · {a.audience}</p>
                </div>
                <button className="text-xs font-medium text-rust hover:underline" onClick={() => window.confirm("Delete this announcement?") && deleteNotice.mutate(a._id)}>Delete</button>
              </div>
            ))}
            {(announcements ?? []).length === 0 && <p className="py-3 text-sm text-graphite-400">No announcements yet.</p>}
          </div>
        </div>

        {/* Holidays */}
        <div className="card space-y-3 p-5">
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Company holidays</p>
          <div className="flex flex-wrap gap-2">
            <input className="input max-w-[200px]" placeholder="e.g. Diwali" value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} />
            <input className="input max-w-[170px]" type="date" value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} />
            <button className="btn-accent" disabled={createHoliday.isPending || holiday.name.length < 2} onClick={() => createHoliday.mutate()}>Add holiday</button>
          </div>
          <div className="divide-y divide-steel-100">
            {(holidays ?? []).map((h) => (
              <div key={h._id} className="flex items-center gap-3 py-2.5">
                <p className="flex-1 text-sm text-graphite-900"><span className="font-semibold">{h.name}</span> <span className="text-graphite-400">· {formatDate(h.date)}</span></p>
                <button className="text-xs font-medium text-rust hover:underline" onClick={() => deleteHoliday.mutate(h._id)}>Remove</button>
              </div>
            ))}
            {(holidays ?? []).length === 0 && <p className="py-3 text-sm text-graphite-400">No holidays set.</p>}
          </div>
          <p className="text-xs text-graphite-400">Holidays show on every worker&apos;s attendance calendar in the app.</p>
        </div>
      </div>

      {/* Leave approvals */}
      <div className="card space-y-3 p-5">
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Leave requests {pendingLeaves.length > 0 && `(${pendingLeaves.length} pending)`}</p>
        {pendingLeaves.length === 0 && decidedLeaves.length === 0 && <p className="text-sm text-graphite-400">No leave requests yet. Workers request leave from the app (Services - Leave).</p>}
        <div className="divide-y divide-steel-100">
          {pendingLeaves.map((l) => (
            <div key={l._id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-graphite-900">{l.worker?.user?.name ?? l.worker?.employeeId} · {l.leaveType} leave</p>
                <p className="text-xs text-graphite-500">{formatDate(l.fromDate)} → {formatDate(l.toDate)}{l.reason ? ` · ${l.reason}` : ""}</p>
              </div>
              <button className="btn-accent" disabled={decideLeave.isPending} onClick={() => decideLeave.mutate({ id: l._id, approve: true })}>Approve</button>
              <button className="btn-ghost text-rust" disabled={decideLeave.isPending} onClick={() => decideLeave.mutate({ id: l._id, approve: false })}>Reject</button>
            </div>
          ))}
          {decidedLeaves.map((l) => (
            <div key={l._id} className="flex flex-wrap items-center gap-3 py-2.5 opacity-70">
              <p className="flex-1 text-sm text-graphite-700">{l.worker?.user?.name ?? l.worker?.employeeId} · {formatDate(l.fromDate)} → {formatDate(l.toDate)} · <span className="font-semibold">{l.status}</span>{l.status === "APPROVED" ? ` (${l.attendanceCreated} day(s) in attendance)` : ""}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-graphite-400">Approving paid leave credits a full day of salary per day through the normal attendance → salary pipeline. Managers can also approve leave for their own site workers from the mobile app.</p>
      </div>
    </div>
  );
}
