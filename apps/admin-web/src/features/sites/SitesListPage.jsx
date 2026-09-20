import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";
import { useAuthStore } from "@/stores/authStore";
import { SiteDetailsPanel } from "./SiteDetailsPanel";

const SITE_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

function useSites(status) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["sites", { status }],
    queryFn: async () => unwrap(api.get(`/sites${qs}`)),
  });
}

function useCreateSite() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (input) => unwrap(api.post("/sites", input)),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success(`Site “${input.name}” created with status PLANNING.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create the site."),
  });
}

export function SitesListPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const { data, isLoading } = useSites(status);
  const createSite = useCreateSite();
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useSocketInvalidate("site:created", [["sites"]]);
  useSocketInvalidate("site:updated", [["sites"]]);

  const [showForm, setShowForm] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    client: "",
    projectType: "",
    startDate: "",
    expectedCompletionDate: "",
    manager: "",
    budgetRupees: "",
    description: "",
  });
  const [selectedSite, setSelectedSite] = useState(null);

  const { data: managersData } = useQuery({
    queryKey: ["users", "managers"],
    queryFn: async () => unwrap(api.get("/users?role=MANAGER&pageSize=100")),
    enabled: isSuperAdmin,
  });
  const managers = managersData?.items ?? [];

  const updateSite = useMutation({
    mutationFn: async ({ id, payload }) => unwrap(api.patch(`/sites/${id}`, payload)),
    onSuccess: (updated, variables) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      // keep details panel in sync if the updated site is currently open
      setSelectedSite((prev) => (prev && prev._id === updated._id ? updated : prev));
      if (variables.silent) {
        toast.success(`Status changed to ${updated.status.replace(/_/g, " ")}.`);
      } else {
        toast.success(`Site “${updated.name}” updated.`);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update the site."),
  });

  const handleQuickStatus = (site, newStatus) => {
    if (newStatus === site.status) return;
    updateSite.mutate({ id: site._id, payload: { status: newStatus }, silent: true });
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      address: form.address.trim(),
    };
    if (form.client.trim()) payload.client = form.client.trim();
    if (form.projectType.trim()) payload.projectType = form.projectType.trim();
    if (form.startDate) payload.startDate = form.startDate;
    if (form.expectedCompletionDate) payload.expectedCompletionDate = form.expectedCompletionDate;
    if (form.manager) payload.manager = form.manager;
    if (form.budgetRupees !== "") {
      const n = Number(form.budgetRupees);
      if (!Number.isNaN(n) && n > 0) payload.budgetRupees = n;
    }
    if (form.description.trim()) payload.description = form.description.trim();

    createSite.mutate(payload, {
      onSuccess: () => {
        setShowForm(false);
        setShowOptional(false);
        setForm({
          name: "",
          code: "",
          address: "",
          client: "",
          projectType: "",
          startDate: "",
          expectedCompletionDate: "",
          manager: "",
          budgetRupees: "",
          description: "",
        });
      },
    });
  };

  const columns = [
    { header: "Code", cell: (s) => <span className="font-mono text-xs">{s.code}</span> },
    {
      header: "Name",
      cell: (s) => (
        <button
          className="text-left font-body font-medium text-graphite-900 hover:text-amber-600 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSite(s);
          }}
        >
          {s.name}
        </button>
      ),
      className: "font-body",
    },
    { header: "Client", cell: (s) => s.client || "—", className: "font-body text-sm" },
    { header: "Type", cell: (s) => s.projectType || "—", className: "font-body text-sm" },
    { header: "Manager", cell: (s) => s.manager?.name ?? "Unassigned", className: "font-body text-sm" },
    {
      header: "Status",
      cell: (s) =>
        isSuperAdmin ? (
          <select
            className="rounded border border-steel-200 bg-surface px-2 py-1 text-xs font-medium focus:border-amber focus:outline-none"
            value={s.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleQuickStatus(s, e.target.value)}
            disabled={updateSite.isPending}
          >
            {SITE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={s.status} />
        ),
    },
    {
      header: "Actions",
      cell: (s) => (
        <button
          className="rounded border border-steel-200 bg-surface px-2.5 py-1 text-xs font-medium text-graphite-600 hover:bg-steel-100 hover:text-graphite-900"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSite(s);
          }}
        >
          Details
        </button>
      ),
    },
  ];

  // Mobile: DataTable already handles overflow, keep panel above table when open
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Sites</h1>
          <p className="text-sm text-graphite-500">
            {data?.length ?? 0} {status ? status.toLowerCase() : ""} sites
            {status && (
              <a href="/sites" className="ml-2 text-amber-600 hover:underline">
                Clear filter
              </a>
            )}
          </p>
        </div>
        <button className="btn-accent" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New site"}
        </button>
      </div>

      {selectedSite && (
        <SiteDetailsPanel site={selectedSite} managers={managers} onClose={() => setSelectedSite(null)} />
      )}

      {showForm && (
        <form className="card space-y-3 p-4" onSubmit={handleCreate}>
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
            New site — starts as <span className="text-amber-600">PLANNING</span> (admin can change status afterwards)
          </p>
          <div className="grid grid-cols-3 gap-3">
            <input
              className="input"
              placeholder="Site name *"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="input"
              placeholder="Code (e.g. PRJ01) *"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <input
              className="input"
              placeholder="Address *"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <button
            type="button"
            className="text-xs font-medium text-amber-600 hover:underline"
            onClick={() => setShowOptional((v) => !v)}
          >
            {showOptional ? "− Hide optional details" : "+ Add more details (client, budget, dates, manager, description)"}
          </button>

          {showOptional && (
            <div className="grid gap-3 rounded border border-dashed border-steel-200 bg-steel-100/30 p-3 md:grid-cols-3">
              <input
                className="input"
                placeholder="Client"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
              />
              <input
                className="input"
                placeholder="Project type"
                value={form.projectType}
                onChange={(e) => setForm({ ...form, projectType: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min="1"
                placeholder="Budget (₹)"
                value={form.budgetRupees}
                onChange={(e) => setForm({ ...form, budgetRupees: e.target.value })}
              />
              <div>
                <label className="mb-1 block text-xs text-graphite-500">Start date</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-graphite-500">Expected completion</label>
                <input
                  type="date"
                  className="input"
                  value={form.expectedCompletionDate}
                  onChange={(e) => setForm({ ...form, expectedCompletionDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-graphite-500">Manager</label>
                <select
                  className="input"
                  value={form.manager}
                  onChange={(e) => setForm({ ...form, manager: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {managers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} — {u.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <textarea
                  className="input min-h-[64px]"
                  rows={2}
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-fit" disabled={createSite.isPending}>
            {createSite.isPending ? "Creating…" : "Create site"}
          </button>
        </form>
      )}

      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        emptyTitle="No sites yet"
        emptyBody="Create your first construction site to start assigning workers."
        onRowClick={(s) => setSelectedSite(s)}
      />

      {!isSuperAdmin && data && data.length > 0 && (
        <p className="text-xs text-graphite-400">
          Only admins can change site status or edit details. Contact your admin to update a site.
        </p>
      )}
    </div>
  );
}
