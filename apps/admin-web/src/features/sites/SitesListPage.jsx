import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

function useSites(status) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["sites", { status }],
    queryFn: async () => unwrap(api.get(`/sites${qs}`))
  });
}

function useCreateSite() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (input) =>
    unwrap(api.post("/sites", input)),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success(`Site “${input.name}” created.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create the site.")
  });
}

export function SitesListPage() {
  const [searchParams] = useSearchParams();
  // Reads ?status=ACTIVE etc so the dashboard "Active sites" KPI card can
  // deep-link straight into a pre-filtered view.
  const status = searchParams.get("status") ?? "";
  const { data, isLoading } = useSites(status);
  const createSite = useCreateSite();
  useSocketInvalidate("site:created", [["sites"]]);
  useSocketInvalidate("site:updated", [["sites"]]);

  const [form, setForm] = useState({ name: "", code: "", address: "" });
  const [showForm, setShowForm] = useState(false);

  const columns = [
  { header: "Code", cell: (s) => s.code },
  { header: "Name", cell: (s) => s.name, className: "font-body" },
  { header: "Address", cell: (s) => s.address, className: "font-body" },
  { header: "Manager", cell: (s) => s.manager?.name ?? "Unassigned", className: "font-body" },
  { header: "Status", cell: (s) => <StatusBadge status={s.status} /> }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Sites</h1>
          <p className="text-sm text-graphite-500">
            {data?.length ?? 0} {status ? status.toLowerCase() : ""} sites
            {status &&
            <a href="/sites" className="ml-2 text-amber-600 hover:underline">
                Clear filter
              </a>
            }
          </p>
        </div>
        <button className="btn-accent" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New site"}
        </button>
      </div>

      {showForm &&
      <form
        className="card grid grid-cols-3 gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          createSite.mutate(form, { onSuccess: () => setShowForm(false) });
        }}>
        
          <input
          className="input"
          placeholder="Site name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        
          <input
          className="input"
          placeholder="Code (e.g. PRJ01)"
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })} />
        
          <input
          className="input"
          placeholder="Address"
          required
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })} />
        
          <button type="submit" className="btn-primary col-span-3 w-fit" disabled={createSite.isPending}>
            Create site
          </button>
        </form>
      }

      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        emptyTitle="No sites yet"
        emptyBody="Create your first construction site to start assigning workers." />
      
    </div>);

}