import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Shield, Users, Copy, Check, X } from "lucide-react";
import { api, unwrap } from "@/lib/apiClient";
import { useToast } from "@/components/ui/Toast";

const BASE_ROLE_HELP = {
  SUPER_ADMIN: "Full access to everything, including roles and money.",
  MANAGER: "Works with sites and workers they are assigned to.",
  WORKER: "Sees only their own attendance, salary and requests.",
};

export function PermissionsPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => unwrap(api.get("/roles")),
  });

  const configurableRoles = useMemo(() => (roles ?? []).filter((r) => r.key !== "SUPER_ADMIN"), [roles]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [creating, setCreating] = useState(false);
  const activeRoleId = selectedRoleId || configurableRoles[0]?.id || "";
  const activeRole = configurableRoles.find((r) => r.id === activeRoleId);

  const { data: matrix, isLoading } = useQuery({
    queryKey: ["permissions", activeRoleId],
    queryFn: async () => unwrap(api.get(`/permissions/role/${activeRoleId}`)),
    enabled: Boolean(activeRoleId),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["roles"] });
    qc.invalidateQueries({ queryKey: ["permissions"] });
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  const update = useMutation({
    mutationFn: async (updates) => unwrap(api.patch(`/permissions/role/${activeRoleId}`, { updates })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissions", activeRoleId] }),
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not save permission.");
      qc.invalidateQueries({ queryKey: ["permissions", activeRoleId] });
    },
  });

  const grouped = (matrix ?? []).reduce((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  const enabledCount = (matrix ?? []).filter((p) => p.enabled).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Roles &amp; permissions</h1>
          <p className="text-sm text-graphite-500">
            Create roles for your team, then choose exactly what each one can do. Super Admin always has full access.
          </p>
        </div>
        <button className="btn-primary inline-flex items-center justify-center gap-1.5" onClick={() => setCreating((v) => !v)}>
          {creating ? <X size={14} /> : <Plus size={14} />}
          {creating ? "Close" : "New role"}
        </button>
      </div>

      {creating && (
        <CreateRoleForm
          roles={roles ?? []}
          onCreated={(role) => {
            setCreating(false);
            setSelectedRoleId(role.id);
            refreshAll();
            toast.success(`Role “${role.label}” created. Now choose its permissions.`);
          }}
          onError={(err) => toast.error(err instanceof Error ? err.message : "Could not create role.")}
        />
      )}

      {/* Role switcher: horizontal scroll on phones, wraps on wide screens */}
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {configurableRoles.map((r) => {
          const active = activeRoleId === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRoleId(r.id)}
              className={`snap-start shrink-0 rounded-xl border px-3 py-2 text-left transition-all duration-150 ${
                active
                  ? "border-graphite-900 bg-graphite-900 text-paper shadow-md"
                  : "border-steel-200 bg-surface text-graphite-700 hover:border-graphite-300"
              }`}
            >
              <span className="block text-sm font-semibold">{r.label}</span>
              <span className={`block text-[11px] ${active ? "text-paper/70" : "text-graphite-400"}`}>
                {r.isSystemRole ? "Built-in" : "Custom"} · {r.userCount} user{r.userCount === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {activeRole && (
        <RoleHeader
          role={activeRole}
          enabledCount={enabledCount}
          total={matrix?.length ?? 0}
          onSaved={refreshAll}
          onDeleted={() => {
            setSelectedRoleId("");
            refreshAll();
          }}
        />
      )}

      {isLoading || !activeRoleId ? (
        <p className="text-sm text-graphite-500">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(grouped).map(([group, perms]) => {
            const allOn = perms.every((p) => p.enabled);
            return (
              <section key={group} className="card p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">{group}</p>
                  <button
                    className="rounded-md px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                    onClick={() =>
                      update.mutate(perms.map((p) => ({ permissionKey: p.key, enabled: !allOn })))
                    }
                    disabled={update.isPending}
                  >
                    {allOn ? "Clear group" : "Select all"}
                  </button>
                </div>
                <div className="divide-y divide-steel-100">
                  {perms.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-start justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm text-graphite-900">{p.description}</span>
                        <span className="block truncate font-mono text-[11px] text-graphite-300">{p.key}</span>
                      </span>
                      <Toggle
                        checked={p.enabled}
                        disabled={update.isPending}
                        onChange={(next) => update.mutate([{ permissionKey: p.key, enabled: next }])}
                      />
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="absolute inset-0 rounded-full bg-steel-200 transition-colors duration-200 peer-checked:bg-teal peer-disabled:opacity-50" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5" />
    </span>
  );
}

function CreateRoleForm({ roles, onCreated, onError }) {
  const [form, setForm] = useState({ label: "", description: "", baseRole: "WORKER", cloneFromRoleId: "" });
  const create = useMutation({
    mutationFn: async (input) => unwrap(api.post("/roles", input)),
    onSuccess: onCreated,
    onError,
  });

  const submit = (e) => {
    e.preventDefault();
    create.mutate({
      label: form.label.trim(),
      description: form.description.trim() || undefined,
      baseRole: form.baseRole,
      cloneFromRoleId: form.cloneFromRoleId || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="card grid gap-4 p-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-graphite-500">Role name *</label>
        <input
          className="input w-full"
          required
          minLength={2}
          maxLength={60}
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="e.g. Site Supervisor"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-graphite-500">Base type *</label>
        <select className="input w-full" value={form.baseRole} onChange={(e) => setForm({ ...form, baseRole: e.target.value })}>
          <option value="MANAGER">Manager-level</option>
          <option value="WORKER">Worker-level</option>
          <option value="SUPER_ADMIN">Super Admin-level</option>
        </select>
        <p className="mt-1 text-[11px] text-graphite-400">{BASE_ROLE_HELP[form.baseRole]}</p>
      </div>
      <div>
        <label className="mb-1 block text-xs text-graphite-500">Start from (copy permissions)</label>
        <select className="input w-full" value={form.cloneFromRoleId} onChange={(e) => setForm({ ...form, cloneFromRoleId: e.target.value })}>
          <option value="">Empty — no permissions</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              Copy from {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-graphite-500">Description</label>
        <input
          className="input w-full"
          maxLength={300}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What this role is for"
        />
      </div>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <button className="btn-accent inline-flex items-center gap-1.5" disabled={create.isPending}>
          <Copy size={14} />
          {create.isPending ? "Creating…" : "Create role"}
        </button>
      </div>
    </form>
  );
}

function RoleHeader({ role, enabledCount, total, onSaved, onDeleted }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ label: role.label, description: role.description ?? "" });

  const save = useMutation({
    mutationFn: async (payload) => unwrap(api.patch(`/roles/${role.id}`, payload)),
    onSuccess: () => {
      setEditing(false);
      toast.success("Role updated.");
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update role."),
  });

  const remove = useMutation({
    mutationFn: async () => unwrap(api.delete(`/roles/${role.id}`)),
    onSuccess: () => {
      toast.success(`Role “${role.label}” deleted.`);
      onDeleted();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete role."),
  });

  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      {editing ? (
        <form
          className="flex flex-1 flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ label: draft.label.trim(), description: draft.description.trim() });
          }}
        >
          <input className="input flex-1" required minLength={2} maxLength={60} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <input className="input flex-[2]" maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description" />
          <div className="flex gap-2">
            <button className="btn-accent inline-flex items-center gap-1" disabled={save.isPending}>
              <Check size={14} /> Save
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Shield size={16} className="text-amber" />
            <h2 className="font-display text-base font-semibold text-graphite-900">{role.label}</h2>
            <span className="rounded-full bg-steel-100 px-2 py-0.5 font-mono text-[10px] text-graphite-500">{role.key}</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal">Base: {role.baseRole}</span>
          </div>
          <p className="mt-1 text-sm text-graphite-500">
            {role.description || BASE_ROLE_HELP[role.baseRole] || "No description."}
          </p>
          <p className="mt-1 flex items-center gap-3 text-xs text-graphite-400">
            <span className="inline-flex items-center gap-1">
              <Users size={12} /> {role.userCount} user{role.userCount === 1 ? "" : "s"}
            </span>
            <span>
              {enabledCount} of {total} permissions on
            </span>
          </p>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost inline-flex items-center gap-1" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </button>
          {!role.isSystemRole && (
            <button
              className="inline-flex items-center gap-1 rounded-md border border-rust/30 px-3 py-1.5 text-sm text-rust hover:bg-rust-50 disabled:opacity-40"
              disabled={remove.isPending || role.userCount > 0}
              title={role.userCount > 0 ? "Reassign users before deleting this role" : "Delete role"}
              onClick={() => {
                if (window.confirm(`Delete role “${role.label}”? This cannot be undone.`)) remove.mutate();
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
