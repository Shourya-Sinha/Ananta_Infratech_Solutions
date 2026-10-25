import { useState } from "react";
import { useRegisterManager, useSitesForSelect } from "./api";
import { useToast } from "@/components/ui/Toast";

const EMPTY_FORM = { name: "", phone: "", email: "", password: "", siteId: "" };

/**
 * Super Admin "Add manager": registers a MANAGER account (login + temporary
 * password shown once, same handover pattern as Add Worker) and optionally
 * assigns them to a site in the same step, so the site immediately has a
 * manager who can mark that site's attendance from the mobile app.
 */
export function AddManagerPanel() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);
  const { data: sites } = useSitesForSelect();
  const register = useRegisterManager();
  const toast = useToast();
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Full name and phone are required.");
      return;
    }
    try {
      const result = await register.mutateAsync({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        password: form.password || undefined,
        siteId: form.siteId || undefined
      });
      setCreated({ ...result, name: form.name.trim(), phone: form.phone.trim(), siteName: result.assignedSite?.name ?? null });
      setForm(EMPTY_FORM);
      toast.success(`Manager “${form.name.trim()}” registered${result.assignedSite ? ` and assigned to ${result.assignedSite.name}` : ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the manager.");
    }
  };

  if (created) {
    return (
      <div className="card p-4">
        <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Manager registered</p>
        <p className="mb-3 text-sm text-graphite-500">
          {created.name} can now log in to the mobile app as a <span className="font-medium text-graphite-900">Manager</span>
          {created.siteName ? <> and manage <span className="font-medium text-graphite-900">{created.siteName}</span></> : ""}.
          Hand these credentials over — <span className="font-medium text-graphite-900">the password is shown only this once</span>.
        </p>
        <dl className="mb-4 grid gap-2 rounded-lg bg-steel-50 p-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-graphite-500">Login phone</dt><dd className="font-mono font-medium text-graphite-900">{created.phone}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-graphite-500">Password</dt><dd className="font-mono font-medium text-graphite-900">{created.temporaryPassword}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-graphite-500">Role</dt><dd className="font-medium text-graphite-900">Manager</dd></div>
          {created.siteName && <div className="flex justify-between gap-4"><dt className="text-graphite-500">Assigned site</dt><dd className="font-medium text-graphite-900">{created.siteName}</dd></div>}
        </dl>
        <button className="btn-ghost" onClick={() => setCreated(null)}>Register another manager</button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Add manager — Super Admin</p>
      <p className="mb-3 text-xs text-graphite-500">
        Creates a Manager login account. Assign a site now (or later from Sites → Details → Edit) — the manager
        can then mark attendance and view salary/finance for that site&apos;s workers in the mobile app.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Full name *</label>
          <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Suresh Yadav" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Phone (login) *</label>
          <input className="input" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Email (optional)</label>
          <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="manager@example.com" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Assign to site (optional)</label>
          <select className="input" value={form.siteId} onChange={set("siteId")}>
            <option value="">Assign later</option>
            {sites?.map((s) => (
              <option key={s._id} value={s._id}>{s.name} ({s.code}){s.manager?.name ? ` — currently ${s.manager.name}` : ""}</option>
            ))}
          </select>
          {form.siteId && sites?.find((s) => s._id === form.siteId)?.manager?.name && (
            <p className="mt-1 text-xs text-amber-600">This site already has a manager — assigning will replace them as site manager.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Initial password (optional)</label>
          <input className="input" type="text" value={form.password} onChange={set("password")} placeholder="Leave blank to auto-generate" />
          <p className="mt-1 text-xs text-graphite-500">Min 8 chars with an uppercase letter, a lowercase letter and a number.</p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rust">{error}</p>}
      <div className="mt-3">
        <button className="btn-primary" onClick={submit} disabled={register.isPending}>{register.isPending ? "Registering…" : "Register manager"}</button>
      </div>
    </div>
  );
}
