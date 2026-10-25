import { useEffect, useState } from "react";
import { useSalaryPreview, useSetSalaryRate } from "./api";
import { formatINR } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

const inr = (paise) => formatINR(Math.round((paise ?? 0) / 100));

/**
 * Per-day wage — view, live calculation preview, and EDIT (Super Admin).
 *
 * The worker's pay is stored as ONE basis (set at registration from the
 * Add Worker "Per-day wage" field, editable here any time). Everything else
 * is derived from it by the same engine the salary/finance modules use:
 *   per hour  = per day ÷ full-day hours (default 8)
 *   per month = per day × working days   (default 26)
 *   approximate monthly salary = projected gross − advances − Kharchi
 * Saving affects only attendance posted afterwards — past ledger entries,
 * statements and paid payrolls keep the rate that was in force then.
 */
export function SalaryRatePanel({ workerId, isSuperAdmin }) {
  const { data: preview } = useSalaryPreview(workerId);
  const setRate = useSetSalaryRate();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);

  const rates = preview?.rates;
  const fullDayHours = rates?.fullDayHours ?? 8;
  const workingDays = rates?.workingDaysPerMonth ?? 26;
  const projection = preview?.projection;
  const attendance = preview?.attendance ?? {};
  const monthSoFar = preview?.monthSoFar ?? {};
  const totalDeductions = (monthSoFar.advanceDeductionsPaise ?? 0) + (monthSoFar.kharchiDeductionsPaise ?? 0) + (monthSoFar.otherDeductionsPaise ?? 0);
  const elapsedDays = projection?.elapsedDays ?? attendance.markedDays ?? 0;
  const salaryPeriod = preview?.salaryPeriod;
  const periodDays = salaryPeriod?.totalDays ?? projection?.scheduledDays ?? workingDays;
  const remainingDays = salaryPeriod?.remainingDays ?? projection?.remainingDays ?? workingDays;
  const formatShortDate = (iso) => (iso ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00`)) : "");

  // Prefill the editor with the worker's current effective per-day wage.
  useEffect(() => {
    if (rates?.dailyRatePaise) setAmount(String(Math.round(rates.dailyRatePaise / 100)));
  }, [rates?.dailyRatePaise]);

  const entered = amount === "" ? NaN : Number(amount);
  const derived = Number.isFinite(entered) && entered > 0
    ? { hourly: entered / fullDayHours, daily: entered, monthly: entered * workingDays }
    : null;

  const save = async () => {
    setError(null);
    if (!derived) {
      setError("Enter a per-day wage greater than ₹0.");
      return;
    }
    try {
      const saved = await setRate.mutateAsync({ workerId, mode: "DAILY", amountRupees: entered });
      toast.success(`Per-day wage updated to ${inr(saved.dailyRatePaise)}/day (${inr(saved.hourlyRatePaise)}/hour · ${inr(saved.monthlySalaryPaise)}/month). Applies to attendance from today onwards.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the per-day wage.");
    }
  };

  return (
    <div className="card p-4">
      <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Per-day wage &amp; salary calculation</p>


      {rates && (
        <div className="mb-4 rounded-2xl bg-graphite-900 px-5 py-4 text-paper">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-paper/60">Total salary — current month (live estimate)</p>
              <p className="font-display text-3xl font-semibold tabular-nums">{inr(preview.approximateMonthlyNetPaise)}</p>
              <p className="mt-1 text-xs text-paper/60">
                {salaryPeriod?.from
                  ? <>For this month: {inr(rates.dailyRatePaise)}/day × {periodDays} day{periodDays === 1 ? "" : "s"} ({formatShortDate(salaryPeriod.from)}–{formatShortDate(salaryPeriod.to)}) = {inr(preview.approximateMonthlyGrossPaise)} before deductions{preview.workerStartDate && salaryPeriod.from > `${preview.month}-01` ? <> — counted from the worker&apos;s joining/creation date, not from the 1st</> : ""}. {remainingDays} day{remainingDays === 1 ? "" : "s"} still earnable.</>
                  : <>Starts at {inr(rates.dailyRatePaise)}/day × {periodDays} days = {inr(preview.approximateMonthlyGrossPaise)} when the worker is newly created and fully present.</>}
              </p>
            </div>
            <div className="text-right text-xs text-paper/70">
              <p>{elapsedDays} day{elapsedDays === 1 ? "" : "s"} elapsed · {remainingDays} expected remaining</p>
              <p>{attendance.presentDays ?? 0} present · {attendance.halfDays ?? 0} half · {attendance.absentDays ?? 0} absent</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 text-xs sm:grid-cols-4">
            <span>Earned so far <strong className="block text-sm text-paper">{inr(monthSoFar.totalEarningsPaise)}</strong></span>
            <span>Advances settled <strong className="block text-sm text-paper">− {inr(monthSoFar.advanceDeductionsPaise)}</strong></span>
            <span>Kharchi settled <strong className="block text-sm text-paper">− {inr(monthSoFar.kharchiDeductionsPaise)}</strong></span>
            <span>Other deductions <strong className="block text-sm text-paper">− {inr(monthSoFar.otherDeductionsPaise)}</strong></span>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-paper/55">
            This total decreases immediately when a day is absent, a day is recorded for fewer hours (for example 2h or 6h instead of {fullDayHours}h), or an advance/Kharchi is settled. Future unrecorded working days are still expected at the full per-day wage.
            {totalDeductions > 0 && <> Total settled deductions: {inr(totalDeductions)}.</>}
            {(preview.pending?.advancePaise > 0 || preview.pending?.kharchiPaise > 0) && <> Requested but not yet settled: {inr((preview.pending?.advancePaise ?? 0) + (preview.pending?.kharchiPaise ?? 0))} (estimated take-home after those: {inr(preview.projectedNetAfterPendingPaise)}).</>}
          </p>
        </div>
      )}
      {rates ? (
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-graphite-500">Per day</dt>
            <dd className="font-mono font-medium text-graphite-900">{inr(rates.dailyRatePaise)}/day</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Per hour</dt>
            <dd className="font-mono font-medium text-graphite-900">{inr(rates.hourlyRatePaise)}/hr</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Full-month standard ({workingDays} days)</dt>
            <dd className="font-mono font-medium text-graphite-900">{inr(preview.approximateMonthlyGrossPaise)}</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Rate source</dt>
            <dd className="font-medium text-graphite-900">
              {rates.source === "WORK_TYPE_DEFAULT" ? "Work-type standard" : rates.source === "NONE" ? "Not set" : "Worker's agreed rate"}
            </dd>
          </div>
          <div>
            <dt className="text-graphite-500">This month so far</dt>
            <dd className="font-mono font-medium text-graphite-900">{inr(preview.monthSoFar?.totalEarningsPaise)} earned</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Approx. monthly net</dt>
            <dd className="font-mono font-medium text-graphite-900">{inr(preview.approximateMonthlyNetPaise)}</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Current-month projected gross</dt>
            <dd className="font-mono font-medium text-graphite-900">{inr(preview.projectedGrossPaise)}</dd>
          </div>
          <div>
            <dt className="text-graphite-500">Basis</dt>
            <dd className="font-medium text-graphite-900">{fullDayHours} hrs/day · {workingDays} days/month</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-graphite-500">Loading salary rates…</p>
      )}

      {isSuperAdmin ? (
        <div className="mt-4 border-t border-steel-200 pt-4">
          <label className="mb-1 block text-xs text-graphite-500">Edit per-day wage (₹/day)</label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-graphite-500">₹</span>
              <input className="input pl-7" type="number" min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 750" />
            </div>
            <button className="btn-primary" onClick={save} disabled={setRate.isPending}>
              {setRate.isPending ? "Saving…" : "Save per-day wage"}
            </button>
          </div>
          {derived && (
            <p className="mt-2 text-xs text-graphite-500">
              At <span className="font-medium text-graphite-900">{formatINR(derived.daily)}/day</span> →{" "}
              per hour <span className="font-medium text-graphite-900">{formatINR(Math.round(derived.hourly))}</span> ·{" "}
              approx. monthly salary <span className="font-medium text-graphite-900">{formatINR(derived.monthly)}</span>{" "}
              ({workingDays} working days).
            </p>
          )}
          {error && <p className="mt-2 text-sm text-rust">{error}</p>}
          <p className="mt-1 text-xs text-graphite-500">
            The new rate applies to attendance posted from now on. Salary already calculated, statements
            already generated and payrolls already paid keep the old rate — finances stay consistent.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-graphite-500">Only Super Admin can change the per-day wage.</p>
      )}
    </div>
  );
}
