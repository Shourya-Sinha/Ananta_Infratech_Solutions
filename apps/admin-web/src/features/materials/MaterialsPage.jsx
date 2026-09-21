import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { formatINR, formatDate } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

const UNITS = ["KG", "BAG", "PIECE", "LITER", "CUBIC_METER", "SQ_FEET", "METER", "TON", "BOX", "ROLL", "OTHER"];
const today = () => new Date().toISOString().slice(0, 10);

export function MaterialsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState("inventory");
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", unit: "KG", category: "", initialStock: "", reorderLevel: "", lastPurchaseRateRupees: "", supplier: "" });
  const [issueForm, setIssueForm] = useState({ materialId: "", siteId: "", quantity: "", type: "ISSUE", date: today(), issuedTo: "", reference: "", note: "" });

  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials", { search, lowStock }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (lowStock) qs.set("lowStock", "true");
      return unwrap(api.get(`/materials?${qs.toString()}`));
    },
  });
  const { data: issues } = useQuery({
    queryKey: ["materials", "issues"],
    queryFn: async () => unwrap(api.get("/materials/issues/list")),
    enabled: tab === "issues",
  });
  const { data: sites } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites")),
  });

  useSocketInvalidate("material:created", [["materials"]]);
  useSocketInvalidate("material:updated", [["materials"]]);
  useSocketInvalidate("material:issued", [["materials"]]);
  useSocketInvalidate("material:returned", [["materials"]]);

  const addStock = useMutation({
    mutationFn: async ({ id, qty, rate }) => {
      return unwrap(api.patch(`/materials/${id}`, { addStock: Number(qty), lastPurchaseRateRupees: rate ? Number(rate) : undefined }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["materials"] }); toast.success("Stock updated."); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed."),
  });

  const save = useMutation({
    mutationFn: async (body) => unwrap(api.post("/materials", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      setShowForm(false);
      setForm({ name: "", code: "", unit: "KG", category: "", initialStock: "", reorderLevel: "", lastPurchaseRateRupees: "", supplier: "" });
      toast.success("Material added to inventory.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed."),
  });

  const issue = useMutation({
    mutationFn: async (body) => unwrap(api.post("/materials/issue", body)),
    onSuccess: (_d, body) => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      setShowIssue(false);
      setIssueForm({ materialId: "", siteId: "", quantity: "", type: "ISSUE", date: today(), issuedTo: "", reference: "", note: "" });
      toast.success(`Material ${body.type === "RETURN" ? "returned" : "issued"}.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Issue failed."),
  });

  const lowStockCount = (materials ?? []).filter(m => m.currentStock <= m.reorderLevel).length;
  const totalValue = (materials ?? []).reduce((sum, m) => sum + Number(m.currentStock || 0) * (Number(m.lastPurchaseRatePaise || 0) / 100), 0);

  const materialColumns = [
    { header: "Code", cell: (m) => m.code ?? "—", className: "font-mono text-xs" },
    { header: "Name", cell: (m) => <span className="font-medium">{m.name}</span>, className: "font-body" },
    { header: "Category", cell: (m) => m.category ?? "—" },
    { header: "Stock", cell: (m) => <span className={cx("font-mono", Number(m.currentStock) <= Number(m.reorderLevel) ? "text-rust" : "")}>{m.currentStock} {m.unit}</span> },
    { header: "Reorder at", cell: (m) => `${m.reorderLevel ?? 0} ${m.unit}` },
    { header: "Last rate", cell: (m) => m.lastPurchaseRatePaise ? formatINR(Math.round(m.lastPurchaseRatePaise / 100)) : "—" },
    { header: "Supplier", cell: (m) => m.supplier?.name ?? "—" },
    {
      header: "", cell: (m) => (
        <div className="flex gap-2">
          <button className="text-xs font-medium text-teal hover:underline" onClick={() => {
            const qty = window.prompt("Add stock quantity:");
            if (!qty) return;
            const rate = window.prompt("Purchase rate (₹, optional):") || 0;
            addStock.mutate({ id: m._id, qty, rate });
          }}>Add stock</button>
          <button className="text-xs font-medium text-amber-600 hover:underline" onClick={() => { setIssueForm({ ...issueForm, materialId: m._id }); setShowIssue(true); setTab("issues"); }}>Issue</button>
        </div>
      )
    },
  ];

  const issueColumns = [
    { header: "Date", cell: (i) => formatDate(i.date) },
    { header: "Type", cell: (i) => <StatusBadge status={i.type === "ISSUE" ? "PAID" : "COMPLETED"} /> },
    { header: "Material", cell: (i) => i.material?.name ?? "—", className: "font-body" },
    { header: "Site", cell: (i) => i.site?.name ?? "—", className: "font-body" },
    { header: "Qty", cell: (i) => `${i.quantity} ${i.material?.unit ?? ""}` },
    { header: "Issued to", cell: (i) => i.issuedTo ?? "—" },
    { header: "Reference", cell: (i) => i.reference ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Materials & Inventory</h1>
          <p className="text-sm text-graphite-500">Track construction materials stock, issue them to sites, monitor reorder levels.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowIssue((v) => !v)}>Issue/Return</button>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add material"}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Materials" value={String(materials?.length ?? 0)} />
        <KpiCard label="Low stock items" value={String(lowStockCount)} tone={lowStockCount > 0 ? "negative" : "neutral"} />
        <KpiCard label="Inventory value (approx)" value={formatINR(Math.round(totalValue))} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex rounded border border-steel-200 bg-surface p-0.5">
          {["inventory", "issues"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`}>{t === "issues" ? "Issues & Returns" : "Inventory"}</button>
          ))}
        </div>
        {tab === "inventory" && <>
          <input className="input max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Low stock only</label>
        </>}
      </div>

      {showForm && (
        <form className="card grid gap-3 p-4 md:grid-cols-4" onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ ...form, initialStock: form.initialStock ? Number(form.initialStock) : 0, reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : 0, lastPurchaseRateRupees: form.lastPurchaseRateRupees ? Number(form.lastPurchaseRateRupees) : undefined, supplier: form.supplier || undefined });
        }}>
          <input className="input md:col-span-2" placeholder="Material name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Code (optional)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input className="input" placeholder="Category (Cement, Steel…)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="input" type="number" placeholder="Initial stock" value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: e.target.value })} />
          <input className="input" type="number" placeholder="Reorder level" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          <input className="input" type="number" placeholder="Last purchase rate (₹)" value={form.lastPurchaseRateRupees} onChange={(e) => setForm({ ...form, lastPurchaseRateRupees: e.target.value })} />
          <button type="submit" className="btn-primary md:col-span-4 w-fit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Add to inventory"}</button>
        </form>
      )}

      {showIssue && (
        <form className="card grid gap-3 p-4 md:grid-cols-4" onSubmit={(e) => {
          e.preventDefault();
          issue.mutate({ ...issueForm, quantity: Number(issueForm.quantity), ratePaise: 0 });
        }}>
          <select className="input" required value={issueForm.materialId} onChange={(e) => setIssueForm({ ...issueForm, materialId: e.target.value })}>
            <option value="">Select material…</option>
            {materials?.map((m) => <option key={m._id} value={m._id}>{m.name} ({m.currentStock} {m.unit})</option>)}
          </select>
          <select className="input" required value={issueForm.siteId} onChange={(e) => setIssueForm({ ...issueForm, siteId: e.target.value })}>
            <option value="">Select site…</option>
            {sites?.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
          </select>
          <select className="input" value={issueForm.type} onChange={(e) => setIssueForm({ ...issueForm, type: e.target.value })}>
            <option value="ISSUE">Issue (to site)</option>
            <option value="RETURN">Return (to inventory)</option>
          </select>
          <input className="input" type="number" min="1" placeholder="Quantity" required value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })} />
          <input type="date" className="input" required value={issueForm.date} onChange={(e) => setIssueForm({ ...issueForm, date: e.target.value })} />
          <input className="input" placeholder="Issued to (person)" value={issueForm.issuedTo} onChange={(e) => setIssueForm({ ...issueForm, issuedTo: e.target.value })} />
          <input className="input" placeholder="Reference / challan #" value={issueForm.reference} onChange={(e) => setIssueForm({ ...issueForm, reference: e.target.value })} />
          <input className="input" placeholder="Note" value={issueForm.note} onChange={(e) => setIssueForm({ ...issueForm, note: e.target.value })} />
          <button type="submit" className="btn-primary md:col-span-4 w-fit" disabled={issue.isPending}>{issue.isPending ? "Posting…" : "Post entry"}</button>
        </form>
      )}

      {tab === "inventory"
        ? <DataTable columns={materialColumns} rows={materials} isLoading={isLoading} emptyTitle="No materials in inventory" emptyBody="Add cement, steel, sand, bricks and other materials to begin tracking stock." />
        : <DataTable columns={issueColumns} rows={issues} emptyTitle="No issues yet" emptyBody="Use Issue/Return to move material between the godown and sites." />}
    </div>
  );
}

function cx(...args) { return args.filter(Boolean).join(" "); }
