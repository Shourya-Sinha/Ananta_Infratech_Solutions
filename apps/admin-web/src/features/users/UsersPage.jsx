import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, Shield, Trash2, Edit2, Ban, CheckCircle } from "lucide-react";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

const ROLE_OPTIONS = ["", "SUPER_ADMIN", "MANAGER", "WORKER"];
const STATUS_OPTIONS = ["", "ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"];

function useUsers({ search, role, status, page, pageSize }) {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (role) qs.set("role", role);
  if (status) qs.set("status", status);
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));
  return useQuery({
    queryKey: ["users", { search, role, status, page, pageSize }],
    queryFn: async () => unwrap(api.get(`/users?${qs.toString()}`)),
  });
}

export function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useUsers({ search, role, status, page, pageSize });
  useSocketInvalidate("user:created", [["users"]]);
  useSocketInvalidate("user:updated", [["users"]]);
  useSocketInvalidate("user:status_changed", [["users"]]);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", roleKey: "MANAGER" });
  const [createdResult, setCreatedResult] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });

  const create = useMutation({
    mutationFn: async (input) => unwrap(api.post("/users", input)),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setCreatedResult(result);
      toast.success(`User “${result.user.name}” created as ${result.user.role?.label ?? form.roleKey}.`);
      setForm({ name: "", phone: "", email: "", roleKey: "MANAGER" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create user."),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }) => unwrap(api.patch(`/users/${id}`, payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated.");
      setEditing(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed."),
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, status: newStatus }) => unwrap(api.post(`/users/${id}/status`, { status: newStatus })),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(`User ${user.name} is now ${user.status}.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Status change failed."),
  });

  const remove = useMutation({
    mutationFn: async (id) => unwrap(api.delete(`/users/${id}`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deactivated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not deactivate user."),
  });

  const startEdit = (u) => {
    setEditing(u._id);
    setEditForm({ name: u.name ?? "", email: u.email ?? "" });
  };

  const columns = [
    {
      header: "Name",
      cell: (u) => (
        <div>
          <p className="font-medium text-graphite-900">{u.name}</p>
          <p className="text-xs text-graphite-400">{u._id.slice(-6)}</p>
        </div>
      ),
      className: "font-body",
    },
    { header: "Phone", cell: (u) => <span className="font-mono text-xs">{u.phone}</span> },
    { header: "Email", cell: (u) => u.email ?? "—", className: "font-body text-sm" },
    {
      header: "Role",
      cell: (u) => (
        <span className="inline-flex items-center gap-1.5">
          <Shield size={12} className="text-graphite-400" />
          {u.role?.key ?? u.role?.label ?? "—"}
        </span>
      ),
    },
    { header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
    {
      header: "Actions",
      cell: (u) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            className="rounded border border-steel-200 px-2 py-1 text-xs hover:bg-steel-100"
            onClick={() => startEdit(u)}
          >
            <Edit2 size={12} className="inline mr-1" />
            Edit
          </button>
          {u.status === "ACTIVE" ? (
            <button
              className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-600 hover:bg-amber-100"
              onClick={() => {
                if (window.confirm(`Suspend ${u.name}? Their sessions will be revoked.`)) {
                  setStatusMut.mutate({ id: u._id, status: "SUSPENDED" });
                }
              }}
            >
              <Ban size={12} className="inline mr-1" />
              Suspend
            </button>
          ) : u.status === "SUSPENDED" ? (
            <button
              className="rounded border border-teal-200 bg-teal-50 px-2 py-1 text-xs text-teal hover:bg-teal-100"
              onClick={() => setStatusMut.mutate({ id: u._id, status: "ACTIVE" })}
            >
              <CheckCircle size={12} className="inline mr-1" />
              Activate
            </button>
          ) : null}
          <button
            className="rounded border border-rust-100 bg-rust-50 px-2 py-1 text-xs text-rust hover:bg-rust-100"
            onClick={() => {
              if (window.confirm(`Deactivate ${u.name}? This suspends the account.`)) remove.mutate(u._id);
            }}
          >
            <Trash2 size={12} className="inline mr-1" />
            Deactivate
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Users</h1>
          <p className="text-sm text-graphite-500">
            {data?.total ?? 0} total users · Managers, Admins & Workers (via User accounts)
          </p>
        </div>
        <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => setShowCreate((v) => !v)}>
          <UserPlus size={14} />
          {showCreate ? "Close" : "New user"}
        </button>
      </div>

      {createdResult && (
        <div className="card border-amber bg-amber-50 p-4">
          <p className="font-display text-sm font-semibold text-amber-600">User created — credentials (shown once)</p>
          <dl className="mt-3 grid gap-2 rounded bg-surface p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-graphite-500">Name</dt>
              <dd className="font-medium">{createdResult.user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-graphite-500">Phone (login)</dt>
              <dd className="font-mono font-medium">{createdResult.user.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-graphite-500">Role</dt>
              <dd className="font-medium">{createdResult.user.role?.label ?? form.roleKey}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-graphite-500">Temporary password</dt>
              <dd className="font-mono font-medium text-rust">{createdResult.temporaryPassword}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-graphite-500">
            Hand this password to the user in person — it is not stored in plain text and will not be shown again.
          </p>
          <button className="btn-ghost mt-3 !py-1 text-xs" onClick={() => setCreatedResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {showCreate && (
        <form
          className="card grid gap-3 p-4 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              name: form.name.trim(),
              phone: form.phone.trim(),
              email: form.email.trim() || undefined,
              roleKey: form.roleKey,
            });
          }}
        >
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Full name *</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Priya Manager"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Phone (login) *</label>
            <input
              className="input"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="10-digit mobile"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Email (optional)</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Role *</label>
            <select
              className="input"
              value={form.roleKey}
              onChange={(e) => setForm({ ...form, roleKey: e.target.value })}
            >
              <option value="MANAGER">MANAGER</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="WORKER">WORKER</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <button type="submit" className="btn-accent" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create user"}
            </button>
            <span className="ml-2 text-xs text-graphite-500">Creates an ACTIVE, phone-verified account immediately.</span>
          </div>
        </form>
      )}

      {editing && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Name</label>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Email</label>
            <input
              className="input"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => update.mutate({ id: editing, payload: { name: editForm.name.trim(), email: editForm.email.trim() || undefined } })}
            disabled={update.isPending}
          >
            Save
          </button>
          <button className="btn-ghost" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-graphite-300" />
          <input
            className="input w-full pl-8"
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="input max-w-[10rem]"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r || "All roles"}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[10rem]"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} rows={data?.items} isLoading={isLoading} emptyTitle="No users found" emptyBody="Create the first manager or admin account above." />

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-graphite-500">
            Page {data.page} of {data.totalPages} · {data.total} users
          </span>
          <div className="flex gap-2">
            <button
              className="btn-ghost !py-1"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn-ghost !py-1"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
