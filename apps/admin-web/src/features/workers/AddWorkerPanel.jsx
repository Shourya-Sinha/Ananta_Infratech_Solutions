import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegisterWorker, useSitesForSelect, useWorkTypes } from "./api";
import { formatINR } from "@/lib/format";

const EMPTY_FORM = { name: "", phone: "", email: "", workTypeId: "", siteId: "", password: "" };

/**
 * Super Admin "Add worker" panel: one-shot worker registration from the
 * Admin Web UI. Creates the login account (active + phone-verified, so no
 * mobile OTP round-trip is needed) and the worker profile together, with an
 * optional initial site assignment. On success the temporary password is
 * shown exactly once for handover to the worker in person.
 */
export function AddWorkerPanel() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);
  const { data: workTypes } = useWorkTypes();
  const { data: sites } = useSitesForSelect();
  const register = useRegisterWorker();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (!form.name.trim() || !form.phone.trim() || !form.workTypeId) {
      setError("Full name, phone and work type are required.");
      return;
    }
    try {
      const result = await register.mutateAsync({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        workTypeId: form.workTypeId,
        siteId: form.siteId || undefined,
        password: form.password || undefined
      });
      setCreated({ ...result, name: form.name.trim(), phone: form.phone.trim() });
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the worker.");
    }
  };

  if (created) {
    return (
      <div className="card p-4">
        <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
          Worker registered
        </p>
        <p className="mb-3 text-sm text-graphite-500">
          {created.name} is on the roster with Employee ID{" "}
          <span className="font-medium text-graphite-900">{created.profile.employeeId}</span>. Hand
          these login credentials to the worker —{" "}
          <span className="font-medium text-graphite-900">the password is shown only this once</span>.
        </p>
        <dl className="mb-4 grid gap-2 rounded-lg bg-steel-50 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-graphite-500">Employee ID</dt>
            <dd className="font-mono font-medium text-graphite-900">{created.profile.employeeId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-graphite-500">Login phone</dt>
            <dd className="font-mono font-medium text-graphite-900">{created.phone}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-graphite-500">Password</dt>
            <dd className="font-mono font-medium text-graphite-900">{created.temporaryPassword}</dd>
          </div>
        </dl>
        <p className="mb-3 text-xs text-graphite-500">
          Next: upload the worker&apos;s documents on their detail page and verify them to complete
          registration.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => navigate(`/workers/${created.profile._id}`)}>
            Open worker profile
          </button>
          <button className="btn-ghost" onClick={() => setCreated(null)}>
            Register another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
        Add worker — Super Admin
      </p>
      <p className="mb-3 text-xs text-graphite-500">
        Creates the worker&apos;s login account and profile in one step. The worker can log in on the
        mobile app immediately — no OTP registration needed. Documents are uploaded and verified
        afterwards on the worker&apos;s detail page.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Full name *</label>
          <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Ramesh Kumar" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Phone (login) *</label>
          <input className="input" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Email (optional)</label>
          <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="worker@example.com" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Work type *</label>
          <select className="input" value={form.workTypeId} onChange={set("workTypeId")}>
            <option value="">Select a work type…</option>
            {workTypes?.map((wt) =>
            <option key={wt._id} value={wt._id} disabled={!wt.isActive}>
                {wt.name} — {formatINR((wt.defaultDailyRatePaise ?? 0) / 100)}/day
              </option>
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Site (optional)</label>
          <select className="input" value={form.siteId} onChange={set("siteId")}>
            <option value="">Assign later</option>
            {sites?.map((s) =>
            <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Initial password (optional)</label>
          <input className="input" type="text" value={form.password} onChange={set("password")} placeholder="Leave blank to auto-generate" />
          <p className="mt-1 text-xs text-graphite-500">Min 8 chars with an uppercase letter, a lowercase letter and a number.</p>
        </div>
      </div>
      {error &&
      <p className="mt-2 text-sm text-rust">
          {error}
        </p>
      }
      <button className="btn-primary mt-3" onClick={submit} disabled={register.isPending}>
        {register.isPending ? "Registering…" : "Register worker"}
      </button>
    </div>
  );
}