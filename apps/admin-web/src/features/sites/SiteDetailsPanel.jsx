import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api, unwrap } from "@/lib/apiClient";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatINR } from "@/lib/format";

const SITE_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

function toInputDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function SiteDetailsPanel({ site, managers = [], onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    client: "",
    projectType: "",
    startDate: "",
    expectedCompletionDate: "",
    manager: "",
    budgetRupees: "",
    description: "",
    status: "PLANNING",
  });

  useEffect(() => {
    if (!site) return;
    setForm({
      name: site.name ?? "",
      address: site.address ?? "",
      client: site.client ?? "",
      projectType: site.projectType ?? "",
      startDate: toInputDate(site.startDate),
      expectedCompletionDate: toInputDate(site.expectedCompletionDate),
      manager: site.manager?._id ?? (typeof site.manager === "string" ? site.manager : "") ?? "",
      budgetRupees: site.budgetPaise != null ? String(Math.round(site.budgetPaise / 100)) : "",
      description: site.description ?? "",
      status: site.status ?? "PLANNING",
    });
    setEditing(false);
  }, [site]);

  const update = useMutation({
    mutationFn: async (payload) => unwrap(api.patch(`/sites/${site._id}`, payload)),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success(`Site “${updated.name}” updated.`);
      setEditing(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update the site."),
  });

  if (!site) return null;

  const handleSave = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      client: form.client.trim(),
      projectType: form.projectType.trim(),
      description: form.description.trim(),
      status: form.status,
    };
    if (form.manager) payload.manager = form.manager;
    if (form.budgetRupees !== "") {
      const n = Number(form.budgetRupees);
      if (!Number.isNaN(n) && n > 0) payload.budgetRupees = n;
    }
    if (form.startDate) payload.startDate = form.startDate;
    if (form.expectedCompletionDate) payload.expectedCompletionDate = form.expectedCompletionDate;

    // Remove empty optional strings so backend doesn't overwrite with empty if we want to keep? 
    // But for client/projectType/description we intentionally send empty string to allow clearing.
    // For dates/manager/budget we only send when non-empty.
    update.mutate(payload);
  };

  const quickStatusChange = (newStatus) => {
    if (newStatus === site.status) return;
    update.mutate({ status: newStatus });
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold text-graphite-900">{site.name}</h2>
            <span className="rounded bg-steel-100 px-2 py-0.5 font-mono text-xs text-graphite-500">{site.code}</span>
            <StatusBadge status={site.status} />
          </div>
          <p className="mt-1 text-xs text-graphite-500">
            Created {site.createdAt ? formatDate(site.createdAt) : "—"} · {site.address}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!editing && (
            <button className="btn-primary !px-3 !py-1.5 text-sm" onClick={() => setEditing(true)}>
              Edit details & status
            </button>
          )}
          <button
            className="rounded p-1 text-graphite-300 hover:bg-steel-100 hover:text-graphite-700"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!editing ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded bg-steel-100/60 px-3 py-2">
            <span className="text-xs font-medium text-graphite-500">Quick status change (admin):</span>
            <select
              className="input !w-auto !py-1 text-sm"
              value={site.status}
              onChange={(e) => quickStatusChange(e.target.value)}
              disabled={update.isPending}
            >
              {SITE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <span className="text-xs text-graphite-400">PLANNING → ACTIVE → ON_HOLD → COMPLETED or CANCELLED</span>
          </div>

          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-graphite-500">Client</dt>
              <dd className="font-medium text-graphite-900">{site.client || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-graphite-500">Project type</dt>
              <dd className="font-medium text-graphite-900">{site.projectType || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-graphite-500">Start date</dt>
              <dd className="font-medium text-graphite-900">{site.startDate ? formatDate(site.startDate) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-graphite-500">Expected completion</dt>
              <dd className="font-medium text-graphite-900">
                {site.expectedCompletionDate ? formatDate(site.expectedCompletionDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-graphite-500">Budget</dt>
              <dd className="font-mono font-medium text-graphite-900">
                {site.budgetPaise != null ? formatINR(Math.round(site.budgetPaise / 100)) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-graphite-500">Manager</dt>
              <dd className="font-medium text-graphite-900">
                {site.manager?.name ? (
                  <>
                    {site.manager.name} <span className="font-normal text-graphite-500">({site.manager.phone ?? ""})</span>
                  </>
                ) : (
                  "Unassigned"
                )}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-graphite-500">Description</dt>
              <dd className="font-body text-graphite-900">{site.description || "—"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-graphite-500">Address</dt>
              <dd className="font-body text-graphite-900">{site.address}</dd>
            </div>
          </dl>
        </>
      ) : (
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Site name *</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Code</label>
              <input className="input bg-steel-100 text-graphite-500" value={site.code} disabled readOnly />
              <p className="mt-1 text-xs text-graphite-400">Code cannot be changed after creation.</p>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-graphite-700">Address *</label>
              <input
                className="input"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Client</label>
              <input
                className="input"
                placeholder="e.g. Ananta Infratech"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Project type</label>
              <input
                className="input"
                placeholder="e.g. Residential, Commercial"
                value={form.projectType}
                onChange={(e) => setForm({ ...form, projectType: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Start date</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Expected completion</label>
              <input
                type="date"
                className="input"
                value={form.expectedCompletionDate}
                onChange={(e) => setForm({ ...form, expectedCompletionDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Budget (₹)</label>
              <input
                type="number"
                min="1"
                className="input"
                placeholder="e.g. 500000"
                value={form.budgetRupees}
                onChange={(e) => setForm({ ...form, budgetRupees: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Manager</label>
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
            <div>
              <label className="mb-1 block text-xs font-medium text-graphite-700">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {SITE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-graphite-400">Admin can change status any time after creation.</p>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-graphite-700">Description</label>
              <textarea
                className="input min-h-[72px]"
                rows={3}
                placeholder="Optional notes about this site..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
