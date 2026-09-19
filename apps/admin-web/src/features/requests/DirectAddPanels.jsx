import { useState } from "react";
import { useDirectAddAdvance, useDirectAddKharchi } from "./api";
import { useSitesForSelect } from "@/features/workers/api";
import { formatDate } from "@/lib/format";

const KHARCHI_CATEGORIES = ["Food", "Transport", "Tools", "Medical", "Other"];
const today = () => new Date().toISOString().slice(0, 10);

function WorkerSelect({ workers, presetWorkerId, value, onChange }) {
  if (presetWorkerId) {
    const preset = workers?.find((w) => w._id === presetWorkerId);
    return (
      <p className="text-sm text-graphite-900">
        Worker:{" "}
        <span className="font-medium">
          {preset ? `${preset.user?.name} (${preset.employeeId})` : presetWorkerId}
        </span>
      </p>
    );
  }
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a worker…</option>
      {workers?.map((w) =>
      <option key={w._id} value={w._id}>
          {w.user?.name} ({w.employeeId}){w.currentSite ? ` — ${w.currentSite.name}` : ""}
        </option>
      )}
    </select>
  );
}

/**
 * Super Admin direct-add panel for Advances. Creates an APPROVED (or
 * immediately PAID) advance for any worker; the salary deduction is posted
 * through the same pipeline as the request flow, so payroll and net-salary
 * totals update automatically.
 */
export function DirectAdvancePanel({ workers, presetWorkerId }) {
  const [workerId, setWorkerId] = useState(presetWorkerId ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [siteId, setSiteId] = useState("");
  const [markPaidNow, setMarkPaidNow] = useState(true);
  const [message, setMessage] = useState(null);
  const { data: sites } = useSitesForSelect();
  const add = useDirectAddAdvance();

  const submit = async () => {
    setMessage(null);
    if (!workerId || !amount || !reason) {
      setMessage({ ok: false, text: "Select a worker and fill in amount and reason." });
      return;
    }
    try {
      const created = await add.mutateAsync({
        worker: workerId,
        amountRupees: Number(amount),
        reason,
        requestedDate: date,
        site: siteId || undefined,
        markPaidNow
      });
      setMessage({
        ok: true,
        text: `Advance of ₹${created.approvedAmountPaise / 100} recorded as ${created.status.replace(/_/g, " ")} — salary deduction ${markPaidNow ? "posted" : "will post when marked paid"}.`
      });
      setAmount("");
      setReason("");
      setSiteId("");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not add advance." });
    }
  };

  return (
    <div className="card p-4">
      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
        Direct add — Super Admin
      </p>
      <p className="mb-3 text-xs text-graphite-500">
        Add an advance to any worker&apos;s account without a worker request. The amount is
        processed through the normal salary pipeline.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Worker</label>
          <WorkerSelect workers={workers} presetWorkerId={presetWorkerId} value={workerId} onChange={setWorkerId} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Amount (₹)</label>
          <input className="input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2000" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Site for ledger entry (optional)</label>
          <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Worker&apos;s current site</option>
            {sites?.map((s) =>
            <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            )}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-graphite-500">Reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Festival advance paid at site" />
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-graphite-900">
        <input type="checkbox" checked={markPaidNow} onChange={(e) => setMarkPaidNow(e.target.checked)} />
        Mark as paid now — deduct from salary immediately
      </label>
      {message &&
      <p className={`mt-2 text-sm ${message.ok ? "text-emerald-700" : "text-rust"}`}>
          {message.text}
        </p>
      }
      <button className="btn-primary mt-3" onClick={submit} disabled={add.isPending}>
        {add.isPending ? "Adding…" : "Add advance"}
      </button>
    </div>
  );
}

/**
 * Super Admin direct-add panel for Kharchi. Approval (and therefore the
 * salary deduction) happens in the same step as creation.
 */
export function DirectKharchiPanel({ workers, presetWorkerId, presetSiteId }) {
  const [workerId, setWorkerId] = useState(presetWorkerId ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [siteId, setSiteId] = useState(presetSiteId ?? "");
  const [message, setMessage] = useState(null);
  const { data: sites } = useSitesForSelect();
  const add = useDirectAddKharchi();

  const submit = async () => {
    setMessage(null);
    if (!workerId || !amount || !category || !reason) {
      setMessage({ ok: false, text: "Select a worker and fill in amount, category and reason." });
      return;
    }
    try {
      const created = await add.mutateAsync({
        worker: workerId,
        amountRupees: Number(amount),
        date,
        category,
        reason,
        site: siteId || undefined
      });
      setMessage({
        ok: true,
        text: `Kharchi of ₹${created.amountPaise / 100} approved on ${formatDate(created.date)} — salary deduction posted.`
      });
      setAmount("");
      setCategory("");
      setReason("");
      setSiteId(presetSiteId ?? "");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not add Kharchi." });
    }
  };

  return (
    <div className="card p-4">
      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
        Direct add — Super Admin
      </p>
      <p className="mb-3 text-xs text-graphite-500">
        Add a Kharchi to any worker&apos;s account without a worker request. It is approved in
        the same step and deducted from salary immediately.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Worker</label>
          <WorkerSelect workers={workers} presetWorkerId={presetWorkerId} value={workerId} onChange={setWorkerId} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Amount (₹)</label>
          <input className="input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Site</label>
          <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Worker&apos;s current site</option>
            {sites?.map((s) =>
            <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select a category…</option>
            {KHARCHI_CATEGORIES.map((c) =>
            <option key={c} value={c}>
                {c}
              </option>
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-graphite-500">Reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Tea/snacks for the gang" />
        </div>
      </div>
      {message &&
      <p className={`mt-2 text-sm ${message.ok ? "text-emerald-700" : "text-rust"}`}>
          {message.text}
        </p>
      }
      <button className="btn-primary mt-3" onClick={submit} disabled={add.isPending}>
        {add.isPending ? "Adding…" : "Add Kharchi"}
      </button>
    </div>
  );
}
