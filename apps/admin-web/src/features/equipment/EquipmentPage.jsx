import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

const CATEGORIES = ["EXCAVATOR", "MIXER", "TOOL", "VEHICLE", "ELECTRICAL", "SAFETY", "SCAFFOLDING", "MEASUREMENT", "OTHER"];
const CONDITIONS = ["NEW", "GOOD", "FAIR", "NEEDS_REPAIR", "DAMAGED"];
const today = () => new Date().toISOString().slice(0, 10);

export function EquipmentPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState("equipment");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", category: "TOOL", serialNumber: "", purchaseDate: "", purchaseRateRupees: "", condition: "GOOD", notes: "" });
  const [assignForm, setAssignForm] = useState({ equipmentId: "", siteId: "", assignedTo: "", dateAssigned: today(), conditionOut: "GOOD", note: "" });

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["equipment", { status: statusFilter }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      return unwrap(api.get(`/equipment?${qs.toString()}`));
    },
  });
  const { data: assignments } = useQuery({
    queryKey: ["equipment", "assignments"],
    queryFn: async () => unwrap(api.get("/equipment/assignments/list?active=true")),
    enabled: tab === "assignments",
  });
  const { data: sites } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites")),
  });

  useSocketInvalidate("equipment:created", [["equipment"]]);
  useSocketInvalidate("equipment:assigned", [["equipment"]]);
  useSocketInvalidate("equipment:returned", [["equipment"]]);

  const save = useMutation({
    mutationFn: async (body) => unwrap(api.post("/equipment", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setShowForm(false);
      setForm({ name: "", code: "", category: "TOOL", serialNumber: "", purchaseDate: "", purchaseRateRupees: "", condition: "GOOD", notes: "" });
      toast.success("Equipment added.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed."),
  });

  const assign = useMutation({
    mutationFn: async (body) => unwrap(api.post("/equipment/assign", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setShowAssign(false);
      setAssignForm({ equipmentId: "", siteId: "", assignedTo: "", dateAssigned: today(), conditionOut: "GOOD", note: "" });
      toast.success("Equipment assigned to site.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Assign failed."),
  });

  const returnEq = useMutation({
    mutationFn: async ({ id, conditionIn }) => unwrap(api.post(`/equipment/assignments/${id}/return`, { conditionIn })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment"] }); toast.success("Equipment returned."); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Return failed."),
  });

  const availableCount = (equipment ?? []).filter((e) => e.status === "AVAILABLE").length;
  const assignedCount = (equipment ?? []).filter((e) => e.status === "ASSIGNED").length;
  const repairCount = (equipment ?? []).filter((e) => e.status === "IN_REPAIR").length;

  const eqColumns = [
    { header: "Code", cell: (e) => e.code ?? "—", className: "font-mono text-xs" },
    { header: "Name", cell: (e) => <span className="font-medium">{e.name}</span> },
    { header: "Category", cell: (e) => e.category?.replace("_", " ") },
    { header: "Serial #", cell: (e) => e.serialNumber ?? "—" },
    { header: "Condition", cell: (e) => <span className="text-xs">{e.condition?.replace("_", " ")}</span> },
    { header: "Status", cell: (e) => <StatusBadge status={e.status === "AVAILABLE" ? "ACTIVE" : e.status === "ASSIGNED" ? "REQUESTED" : e.status === "IN_REPAIR" ? "ON_HOLD" : "CLOSED"} /> },
    {
      header: "", cell: (e) => e.status === "AVAILABLE" ? (
        <button className="text-xs font-medium text-teal hover:underline" onClick={() => { setAssignForm({ ...assignForm, equipmentId: e._id }); setShowAssign(true); setTab("assignments"); }}>Assign</button>
      ) : null
    },
  ];

  const assignColumns = [
    { header: "Assigned", cell: (a) => formatDate(a.dateAssigned) },
    { header: "Equipment", cell: (a) => <><span className="font-medium">{a.equipment?.name}</span> <span className="text-xs text-graphite-400">({a.equipment?.code})</span></> },
    { header: "Site", cell: (a) => a.site?.name ?? "—" },
    { header: "Assigned to", cell: (a) => a.assignedTo ?? "—" },
    { header: "Condition out", cell: (a) => a.conditionOut?.replace("_", " ") },
    {
      header: "", cell: (a) => !a.dateReturned && (
        <button className="text-xs font-medium text-rust hover:underline" onClick={() => {
          const cond = window.prompt("Condition on return (NEW/GOOD/FAIR/NEEDS_REPAIR/DAMAGED):", a.conditionOut);
          if (cond) returnEq.mutate({ id: a._id, conditionIn: cond });
        }}>Return</button>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Equipment & Tools</h1>
          <p className="text-sm text-graphite-500">Track machinery, tools, and safety equipment. Assign them to sites, track condition.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowAssign((v) => !v)}>Assign to site</button>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add equipment"}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total" value={String(equipment?.length ?? 0)} />
        <KpiCard label="Available" value={String(availableCount)} tone="positive" />
        <KpiCard label="Assigned to sites" value={String(assignedCount)} />
        <KpiCard label="In repair" value={String(repairCount)} tone="negative" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex rounded border border-steel-200 bg-surface p-0.5">
          {["equipment", "assignments"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`}>{t === "assignments" ? "Active assignments" : "Equipment"}</button>
          ))}
        </div>
        {tab === "equipment" && (
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {["AVAILABLE", "ASSIGNED", "IN_REPAIR", "RETIRED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        )}
      </div>

      {showForm && (
        <form className="card grid gap-3 p-4 md:grid-cols-4" onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            ...form,
            purchaseDate: form.purchaseDate || undefined,
            purchaseRateRupees: form.purchaseRateRupees ? Number(form.purchaseRateRupees) : undefined
          });
        }}>
          <input className="input md:col-span-2" placeholder="Equipment/tool name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
          <input className="input" placeholder="Serial number" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          <input type="date" className="input" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          <input className="input" type="number" placeholder="Purchase cost (₹)" value={form.purchaseRateRupees} onChange={(e) => setForm({ ...form, purchaseRateRupees: e.target.value })} />
          <select className="input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
          <input className="input md:col-span-4" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" className="btn-primary w-fit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Add equipment"}</button>
        </form>
      )}

      {showAssign && (
        <form className="card grid gap-3 p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); assign.mutate(assignForm); }}>
          <select className="input md:col-span-2" required value={assignForm.equipmentId} onChange={(e) => setAssignForm({ ...assignForm, equipmentId: e.target.value })}>
            <option value="">Select equipment (only available shown)…</option>
            {equipment?.filter(e => e.status === "AVAILABLE").map((e) => <option key={e._id} value={e._id}>{e.name} ({e.code})</option>)}
          </select>
          <select className="input" required value={assignForm.siteId} onChange={(e) => setAssignForm({ ...assignForm, siteId: e.target.value })}>
            <option value="">Select site…</option>
            {sites?.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
          </select>
          <input type="date" className="input" required value={assignForm.dateAssigned} onChange={(e) => setAssignForm({ ...assignForm, dateAssigned: e.target.value })} />
          <input className="input" placeholder="Assigned to (person)" value={assignForm.assignedTo} onChange={(e) => setAssignForm({ ...assignForm, assignedTo: e.target.value })} />
          <select className="input" value={assignForm.conditionOut} onChange={(e) => setAssignForm({ ...assignForm, conditionOut: e.target.value })}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
          <input className="input md:col-span-2" placeholder="Note" value={assignForm.note} onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })} />
          <button type="submit" className="btn-primary w-fit" disabled={assign.isPending}>{assign.isPending ? "Assigning…" : "Assign"}</button>
        </form>
      )}

      {tab === "equipment"
        ? <DataTable columns={eqColumns} rows={equipment} isLoading={isLoading} emptyTitle="No equipment recorded" emptyBody="Add your first machine, tool, or vehicle to start tracking." />
        : <DataTable columns={assignColumns} rows={assignments} emptyTitle="No active assignments" emptyBody="All equipment is in the warehouse/available." />}
    </div>
  );
}
