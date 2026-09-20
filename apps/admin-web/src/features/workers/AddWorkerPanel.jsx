import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { useRegisterWorker, useCheckWorkerDuplicate, useSitesForSelect, useWorkTypes } from "./api";
import { formatINR } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";

const EMPTY_FORM = { name: "", phone: "", email: "", workTypeId: "", siteId: "", password: "" };

/**
 * Super Admin "Add worker" panel: one-shot worker registration from the
 * Admin Web UI. Creates the login account (active + phone-verified, so no
 * mobile OTP round-trip is needed) and the worker profile together, with an
 * optional initial site assignment. On success the temporary password is
 * shown exactly once for handover to the worker in person.
 *
 * DUPLICATE HANDLING: before registering, the entered phone/email is
 * checked against existing accounts. If it is already registered —
 *  • documents NOT verified yet → an amber warning shows exactly WHICH
 *    number/email is already registered and to whom; registering anyway
 *    UPDATES the existing account with the new data (same employee ID).
 *  • documents already verified → hard error: that number/email already
 *    exists and can never be overwritten.
 */
export function AddWorkerPanel() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);
  // Duplicate warning state: null = no conflict; otherwise holds
  // { matches, existing, verified, canOverwrite, message } from the API.
  const [duplicate, setDuplicate] = useState(null);
  const { data: workTypes } = useWorkTypes();
  const { data: sites } = useSitesForSelect();
  const register = useRegisterWorker();
  const checkDuplicate = useCheckWorkerDuplicate();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const buildInput = (confirmDuplicate) => ({
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim() || undefined,
    workTypeId: form.workTypeId,
    siteId: form.siteId || undefined,
    password: form.password || undefined,
    confirmDuplicate: confirmDuplicate || undefined
  });

  const doRegister = async (confirmDuplicate) => {
    const result = await register.mutateAsync(buildInput(confirmDuplicate));
    setCreated({ ...result, name: form.name.trim(), phone: form.phone.trim() });
    setForm(EMPTY_FORM);
    setDuplicate(null);
  };

  const submit = async () => {
    setError(null);
    setDuplicate(null);
    if (!form.name.trim() || !form.phone.trim() || !form.workTypeId) {
      setError("Full name, phone and work type are required.");
      return;
    }
    try {
      // Pre-flight: is this phone/email already registered?
      const check = await checkDuplicate.mutateAsync({
        phone: form.phone.trim(),
        email: form.email.trim() || undefined
      });
      if (check.duplicate) {
        if (!check.canOverwrite) {
          // Document-verified worker (or a non-worker account): hard error.
          setError(check.message);
          return;
        }
        // Unverified worker: show the warning and wait for confirmation.
        setDuplicate(check);
        return;
      }
      await doRegister(false);
    } catch (err) {
      // Fallback for the server-side guard (e.g. the record appeared between
      // the check and the submit): the 409 carries the duplicate details.
      if (err?.code === "CONFLICT" && err?.details?.kind === "DUPLICATE_WORKER") {
        setDuplicate({
          matches: err.details.matches,
          existing: err.details.existing,
          verified: false,
          canOverwrite: true,
          message: err instanceof Error ? err.message : undefined
        });
        return;
      }
      setError(err instanceof Error ? err.message : "Could not register the worker.");
    }
  };

  const confirmDuplicateRegistration = async () => {
    setError(null);
    try {
      await doRegister(true);
    } catch (err) {
      setDuplicate(null);
      setError(err instanceof Error ? err.message : "Could not register the worker.");
    }
  };

  if (created) {
    return (
      <div className="card p-4">
        <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
          {created.updatedExisting ? "Existing worker account updated" : "Worker registered"}
        </p>
        <p className="mb-3 text-sm text-graphite-500">
          {created.updatedExisting &&
          <span className="mb-2 block rounded bg-amber-50 px-3 py-2 text-amber-600">
              An already-registered (unverified) account was found for this phone number — it has
              been <span className="font-medium">updated with the new data</span> instead of creating
              a duplicate. The Employee ID and past records are unchanged.
            </span>
          }
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

  const matchedFields = duplicate
    ? [duplicate.matches?.phone && "phone number", duplicate.matches?.email && "email"].filter(Boolean).join(" and ")
    : "";

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

      {duplicate &&
      <div className="mt-3 rounded border border-amber bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TriangleAlert size={18} className="text-amber-600" />
            <p className="font-display text-sm font-semibold text-amber-600">
              Already registered — {matchedFields} “{duplicate.matches?.phone ? form.phone.trim() : form.email.trim()}”
            </p>
          </div>
          <p className="text-sm text-graphite-700">{duplicate.message}</p>
          {duplicate.existing &&
          <dl className="mt-3 grid gap-1.5 rounded-lg bg-surface p-3 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="text-graphite-500">Registered as</dt>
                <dd className="font-medium text-graphite-900">{duplicate.existing.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-graphite-500">Employee ID</dt>
                <dd className="font-mono font-medium text-graphite-900">{duplicate.existing.employeeId ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-graphite-500">Phone on file</dt>
                <dd className="font-mono font-medium text-graphite-900">{duplicate.existing.phone}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-graphite-500">Documents</dt>
                <dd>
                  <StatusBadge status={duplicate.existing.documentsVerified ? "VERIFIED" : "PENDING_VERIFICATION"} />
                </dd>
              </div>
            </dl>
          }
          <p className="mt-3 text-xs text-graphite-500">
            If you proceed, the <span className="font-medium">existing account</span> will be updated with
            the new data you entered (same employee ID, history kept) and a fresh password will be issued.
            Verified workers can never be overwritten.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-accent" onClick={confirmDuplicateRegistration} disabled={register.isPending}>
              {register.isPending ? "Updating…" : "Yes — update existing account & register"}
            </button>
            <button className="btn-ghost" onClick={() => setDuplicate(null)} disabled={register.isPending}>
              Cancel
            </button>
          </div>
        </div>
      }

      {!duplicate &&
      <button className="btn-primary mt-3" onClick={submit} disabled={register.isPending || checkDuplicate.isPending}>
        {register.isPending ? "Registering…" : checkDuplicate.isPending ? "Checking…" : "Register worker"}
      </button>
      }
    </div>
  );
}
