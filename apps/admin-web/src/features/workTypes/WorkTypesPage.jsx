import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/format";

function useWorkTypes() {
  return useQuery({
    queryKey: ["work-types"],
    queryFn: async () => unwrap(api.get("/work-types"))
  });
}

export function WorkTypesPage() {
  const { data, isLoading } = useWorkTypes();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", defaultDailyRate: "" });
  const [editingId, setEditingId] = useState(null);
  const [editRate, setEditRate] = useState("");

  const create = useMutation({
    mutationFn: async () =>
    unwrap(
      api.post("/work-types", {
        name: form.name,
        code: form.code,
        defaultDailyRate: Number(form.defaultDailyRate)
      })
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-types"] });
      setShowForm(false);
      setForm({ name: "", code: "", defaultDailyRate: "" });
    }
  });

  const updateRate = useMutation({
    mutationFn: async ({ id, rate }) =>
    unwrap(api.patch(`/work-types/${id}`, { defaultDailyRate: rate })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-types"] });
      setEditingId(null);
    }
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }) =>
    unwrap(api.patch(`/work-types/${id}`, { isActive })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-types"] })
  });

  const columns = [
  { header: "Code", cell: (w) => w.code },
  { header: "Name", cell: (w) => w.name, className: "font-body" },
  {
    header: "Daily rate",
    cell: (w) =>
    editingId === w.id ?
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
        className="input w-24 !py-1"
        type="number"
        value={editRate}
        onChange={(e) => setEditRate(e.target.value)} />
      
            <button
        className="text-xs font-medium text-amber-600"
        onClick={() => updateRate.mutate({ id: w.id, rate: Number(editRate) })}>
        
              Save
            </button>
          </div> :

    <span
      className="cursor-pointer hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        setEditingId(w.id);
        setEditRate(String(w.defaultDailyRate));
      }}>
      
            {formatINR(w.defaultDailyRate)}/day
          </span>

  },
  {
    header: "Status",
    cell: (w) =>
    <span
      onClick={(e) => {
        e.stopPropagation();
        toggleActive.mutate({ id: w.id, isActive: !w.isActive });
      }}
      className="cursor-pointer">
      
          <StatusBadge status={w.isActive ? "ACTIVE" : "CLOSED"} />
        </span>

  }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Work Types</h1>
          <p className="text-sm text-graphite-500">Click a rate or status badge to edit it directly.</p>
        </div>
        <button className="btn-accent" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New work type"}
        </button>
      </div>

      {showForm &&
      <form
        className="card grid grid-cols-4 gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}>
        
          <input
          className="input"
          placeholder="Name (e.g. Mason)"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        
          <input
          className="input"
          placeholder="Code (e.g. MASON)"
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })} />
        
          <input
          className="input"
          type="number"
          placeholder="Daily rate (₹)"
          required
          value={form.defaultDailyRate}
          onChange={(e) => setForm({ ...form, defaultDailyRate: e.target.value })} />
        
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            Create
          </button>
        </form>
      }

      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        emptyTitle="No work types yet"
        emptyBody="Create work types like Mason, Carpenter, or Helper to assign to workers." />
      
    </div>);

}