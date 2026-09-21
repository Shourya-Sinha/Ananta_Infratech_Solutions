import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

const WEATHER = ["SUNNY", "CLOUDY", "RAINY", "STORM", "EXTREME_HEAT", "OTHER"];
const today = () => new Date().toISOString().slice(0, 10);

const weatherStyles = {
  SUNNY: "bg-amber-50 text-amber-600",
  CLOUDY: "bg-steel-100 text-graphite-600",
  RAINY: "bg-blue-50 text-blue-600",
  STORM: "bg-rust-50 text-rust",
  EXTREME_HEAT: "bg-orange-50 text-orange-700",
  OTHER: "bg-steel-100 text-graphite-500"
};

export function SiteDiaryPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [site, setSite] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: today(), weather: "SUNNY", workDone: "", workersPresent: "", materialsReceived: "", issues: "", nextDayPlan: "" });
  const [viewing, setViewing] = useState(null);

  const { data: sites } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites")),
  });
  const { data: entries, isLoading } = useQuery({
    queryKey: ["diary", { site }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (site) qs.set("site", site);
      return unwrap(api.get(`/site-diary?${qs.toString()}`));
    },
  });

  useSocketInvalidate("diary:created", [["diary"]]);
  useSocketInvalidate("diary:updated", [["diary"]]);

  const save = useMutation({
    mutationFn: async (body) => unwrap(api.post("/site-diary", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      setShowForm(false);
      setForm({ date: today(), weather: "SUNNY", workDone: "", workersPresent: "", materialsReceived: "", issues: "", nextDayPlan: "" });
      toast.success("Daily log saved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed."),
  });

  const thisWeek = (entries ?? []).filter(e => {
    const d = new Date(e.date); const w = new Date(); w.setDate(w.getDate() - 7); return d >= w;
  }).length;
  const withIssues = (entries ?? []).filter(e => e.issues && e.issues.trim().length > 0).length;

  const columns = [
    { header: "Date", cell: (e) => formatDate(e.date) },
    { header: "Site", cell: (e) => e.site?.name ?? "—", className: "font-body" },
    { header: "Weather", cell: (e) => <span className={`badge ${weatherStyles[e.weather] ?? weatherStyles.OTHER}`}>{e.weather.replace("_", " ")}</span> },
    { header: "Workers", cell: (e) => e.workersPresent ?? "—" },
    { header: "Work done", cell: (e) => <span className="font-body text-sm line-clamp-2 max-w-md">{e.workDone}</span> },
    { header: "Issues", cell: (e) => e.issues ? <span className="text-rust text-xs">⚠ noted</span> : <span className="text-graphite-400 text-xs">none</span> },
    {
      header: "", cell: (e) => (
        <button className="text-xs font-medium text-teal hover:underline" onClick={() => setViewing(e)}>View</button>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Site Diary / Daily Log</h1>
          <p className="text-sm text-graphite-500">Daily construction progress log — weather, work done, workers present, materials received, issues, and next-day plan.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add today's log"}</button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Total entries" value={String(entries?.length ?? 0)} />
        <KpiCard label="Last 7 days" value={String(thisWeek)} />
        <KpiCard label="Entries with issues" value={String(withIssues)} tone={withIssues > 0 ? "negative" : "positive"} />
      </div>

      <div className="flex gap-3">
        <select className="input max-w-xs" value={site} onChange={(e) => setSite(e.target.value)}>
          <option value="">All sites</option>
          {sites?.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
        </select>
      </div>

      {showForm && (
        <form className="card space-y-3 p-4" onSubmit={(e) => {
          e.preventDefault();
          if (!site) { toast.error("Select a site first from the filter above, or in the form."); return; }
          save.mutate({
            siteId: site,
            date: form.date,
            weather: form.weather,
            workDone: form.workDone,
            workersPresent: form.workersPresent ? Number(form.workersPresent) : 0,
            materialsReceived: form.materialsReceived || undefined,
            issues: form.issues || undefined,
            nextDayPlan: form.nextDayPlan || undefined
          });
        }}>
          <div className="grid gap-3 md:grid-cols-3">
            <input type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <select className="input" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })}>
              {WEATHER.map((w) => <option key={w} value={w}>{w.replace("_", " ")}</option>)}
            </select>
            <input className="input" type="number" min="0" placeholder="Workers present" value={form.workersPresent} onChange={(e) => setForm({ ...form, workersPresent: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Work done today *</label>
            <textarea className="input" rows={3} required placeholder="Describe the work completed today" value={form.workDone} onChange={(e) => setForm({ ...form, workDone: e.target.value })} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-graphite-500">Materials received</label>
              <textarea className="input" rows={2} placeholder="e.g. 100 bags cement, 2 ton steel" value={form.materialsReceived} onChange={(e) => setForm({ ...form, materialsReceived: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-graphite-500">Issues / delays</label>
              <textarea className="input" rows={2} placeholder="Any problems, delays, safety incidents" value={form.issues} onChange={(e) => setForm({ ...form, issues: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Plan for tomorrow</label>
            <textarea className="input" rows={2} placeholder="What's planned for the next working day" value={form.nextDayPlan} onChange={(e) => setForm({ ...form, nextDayPlan: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-fit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save log entry"}</button>
        </form>
      )}

      {viewing && (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">{formatDate(viewing.date)} — {viewing.site?.name}</p>
            <button className="text-xs text-graphite-500 hover:underline" onClick={() => setViewing(null)}>Close</button>
          </div>
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div><span className="text-xs uppercase text-graphite-500">Weather</span><p>{viewing.weather.replace("_", " ")}</p></div>
            <div><span className="text-xs uppercase text-graphite-500">Workers present</span><p>{viewing.workersPresent ?? "—"}</p></div>
            <div><span className="text-xs uppercase text-graphite-500">By</span><p>{viewing.createdBy?.name ?? "—"}</p></div>
          </div>
          <div><span className="text-xs uppercase text-graphite-500">Work done</span><p className="whitespace-pre-wrap font-body">{viewing.workDone}</p></div>
          {viewing.materialsReceived && <div><span className="text-xs uppercase text-graphite-500">Materials received</span><p className="whitespace-pre-wrap font-body">{viewing.materialsReceived}</p></div>}
          {viewing.issues && <div><span className="text-xs uppercase text-rust">Issues</span><p className="whitespace-pre-wrap font-body">{viewing.issues}</p></div>}
          {viewing.nextDayPlan && <div><span className="text-xs uppercase text-graphite-500">Next-day plan</span><p className="whitespace-pre-wrap font-body">{viewing.nextDayPlan}</p></div>}
        </div>
      )}

      <DataTable columns={columns} rows={entries} isLoading={isLoading} emptyTitle="No diary entries yet" emptyBody="Start logging daily work progress — what was done, who was present, and any issues encountered." />
    </div>
  );
}
