import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";

const CATEGORIES = ["MATERIAL", "EQUIPMENT", "LABOUR_CONTRACTOR", "TRANSPORT", "OTHER"];

export function SuppliersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contactPerson: "", phone: "", email: "", address: "", gstin: "", category: "MATERIAL", notes: "" });
  const [editingId, setEditingId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", { category, search }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      if (search) qs.set("search", search);
      return unwrap(api.get(`/suppliers?${qs.toString()}`));
    },
  });

  const save = useMutation({
    mutationFn: async (body) => editingId ? unwrap(api.patch(`/suppliers/${editingId}`, body)) : unwrap(api.post("/suppliers", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setShowForm(false);
      setForm({ name: "", contactPerson: "", phone: "", email: "", address: "", gstin: "", category: "MATERIAL", notes: "" });
      setEditingId(null);
      toast.success(editingId ? "Supplier updated." : "Supplier added.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed."),
  });

  const remove = useMutation({
    mutationFn: async (id) => unwrap(api.delete(`/suppliers/${id}`)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Supplier deleted."); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed."),
  });

  const startEdit = (s) => {
    setEditingId(s._id);
    setForm({ name: s.name, contactPerson: s.contactPerson ?? "", phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", gstin: s.gstin ?? "", category: s.category, notes: s.notes ?? "" });
    setShowForm(true);
  };

  const columns = [
    { header: "Name", cell: (s) => <span className="font-medium">{s.name}</span> },
    { header: "Category", cell: (s) => s.category.replace("_", " ") },
    { header: "Contact", cell: (s) => <span className="font-body text-sm">{s.contactPerson ?? "—"} {s.phone ? `· ${s.phone}` : ""}</span> },
    { header: "GSTIN", cell: (s) => s.gstin ?? "—" },
    { header: "Added", cell: (s) => formatDate(s.createdAt) },
    {
      header: "", cell: (s) => (
        <div className="flex gap-2">
          <button className="text-xs font-medium text-amber-600 hover:underline" onClick={() => startEdit(s)}>Edit</button>
          <button className="text-xs font-medium text-rust hover:underline" onClick={() => { if (window.confirm(`Delete supplier ${s.name}?`)) remove.mutate(s._id); }}>Delete</button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Suppliers / Vendors</h1>
          <p className="text-sm text-graphite-500">Manage material suppliers, equipment vendors, labour contractors, and transport providers.</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm((v) => !v); setEditingId(null); if (!showForm) setForm({ name: "", contactPerson: "", phone: "", email: "", address: "", gstin: "", category: "MATERIAL", notes: "" }); }}>
          {showForm ? "Cancel" : "Add supplier"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search name, contact, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
        <KpiCard label="Total suppliers" value={String(data?.length ?? 0)} />
      </div>

      {showForm && (
        <form className="card grid gap-3 p-4 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          <input className="input md:col-span-2" placeholder="Supplier / vendor name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
          <input className="input" placeholder="Contact person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input md:col-span-2" placeholder="GSTIN (optional)" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <textarea className="input md:col-span-3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          <button type="submit" className="btn-primary w-fit" disabled={save.isPending}>{save.isPending ? "Saving…" : editingId ? "Update" : "Save supplier"}</button>
        </form>
      )}

      <DataTable columns={columns} rows={data} isLoading={isLoading} emptyTitle="No suppliers yet" emptyBody="Add your first supplier to begin tracking material and equipment procurement." />
    </div>
  );
}
