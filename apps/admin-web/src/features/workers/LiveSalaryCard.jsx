import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Radio } from "lucide-react";
import { api, unwrap } from "@/lib/apiClient";
import { formatINR, formatDate, cx } from "@/lib/format";

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}`;
};

const rupees = (paise) => (paise ?? 0) / 100;

/**
 * Live month statement for one worker: earnings − advances − kharchi.
 * Reads the ledger directly, so it is correct before payroll is calculated
 * and moves as soon as a deduction is posted (the "salary" query family is
 * invalidated by every advance / kharchi mutation).
 */
export function LiveSalaryCard({ workerId }) {
  const [month, setMonth] = useState(currentMonth());
  const [openDay, setOpenDay] = useState(null);

  const { data, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["salary", "statement", workerId, month],
    queryFn: async () => unwrap(api.get(`/salary/worker/${workerId}/statement?month=${month}`)),
    enabled: Boolean(workerId),
    refetchInterval: month === currentMonth() ? 30_000 : false,
  });

  const t = data?.totals;
  const deductions = t ? t.advanceDeductionsPaise + t.kharchiDeductionsPaise + t.otherDeductionsPaise : 0;
  const pct = (part) => (t?.totalEarningsPaise ? Math.min(100, Math.round((part / t.totalEarningsPaise) * 100)) : 0);

  return (
    <section className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio size={14} className={cx("text-teal", isFetching && "animate-pulse")} />
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Salary statement</p>
          {month === currentMonth() && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal">LIVE</span>}
        </div>
        <input
          type="month"
          className="input w-auto"
          value={month}
          max={currentMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          aria-label="Statement month"
        />
      </div>

      {isLoading || !t ? (
        <p className="text-sm text-graphite-500">Loading statement…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <Bar label="Earnings" value={t.totalEarningsPaise} pctValue={100} tone="teal" />
              <Bar label="Advances" value={-t.advanceDeductionsPaise} pctValue={pct(t.advanceDeductionsPaise)} tone="rust" />
              <Bar label="Kharchi" value={-t.kharchiDeductionsPaise} pctValue={pct(t.kharchiDeductionsPaise)} tone="amber" />
              {t.otherDeductionsPaise > 0 && <Bar label="Other" value={-t.otherDeductionsPaise} pctValue={pct(t.otherDeductionsPaise)} tone="graphite" />}
              <p className="text-xs text-graphite-400">
                {data.attendance.presentDays} present · {data.attendance.halfDays} half · {data.attendance.absentDays} absent · {data.attendance.overtimeHours}h overtime
                {data.payrollStatus !== "LIVE" && <> · payroll {data.payrollStatus.toLowerCase()}</>}
              </p>
            </div>
            <div className="flex flex-col justify-center rounded-xl bg-graphite-900 px-6 py-4 text-paper md:min-w-[14rem]">
              <p className="text-[11px] uppercase tracking-wide text-paper/60">Net for {formatMonth(month)}</p>
              <p className="font-display text-3xl font-semibold tabular-nums transition-all">{formatINR(rupees(t.netSalaryPaise))}</p>
              <p className="mt-1 text-[11px] text-paper/60">
                {formatINR(rupees(t.totalEarningsPaise))} − {formatINR(rupees(deductions))}
              </p>
            </div>
          </div>

          {(data.pending.advancePaise > 0 || data.pending.kharchiPaise > 0) && (
            <div className="mt-4 rounded-lg border border-amber/30 bg-amber-50 px-3 py-2 text-xs text-amber-600">
              Not yet deducted: {data.pending.advancePaise > 0 && <>advances {formatINR(rupees(data.pending.advancePaise))}</>}
              {data.pending.advancePaise > 0 && data.pending.kharchiPaise > 0 && " · "}
              {data.pending.kharchiPaise > 0 && <>kharchi {formatINR(rupees(data.pending.kharchiPaise))}</>}
            </div>
          )}


          {data.dailyAttendance && (
            <>
              <p className="mb-2 mt-5 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
                Attendance &amp; day pay{data.salaryRates ? ` — ${formatINR(rupees(data.salaryRates.dailyRatePaise))}/day · ${formatINR(rupees(data.salaryRates.hourlyRatePaise))}/hr` : ""}
              </p>
              {data.dailyAttendance.length === 0 ? (
                <p className="text-sm text-graphite-400">No attendance marked this month.</p>
              ) : (
                <ul className="divide-y divide-steel-100 rounded-lg border border-steel-200">
                  {data.dailyAttendance.map((d) => (
                    <li key={d.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                      <span className="min-w-24 text-sm font-medium text-graphite-900">{formatDate(d.date)}</span>
                      <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", d.totalEarningPaise > 0 ? "bg-teal-50 text-teal" : "bg-red-50 text-rust")}>{d.label}</span>
                      <span className="flex-1 text-xs text-graphite-500">{d.calculation}</span>
                      <span className="text-sm font-semibold tabular-nums text-graphite-900">{formatINR(rupees(d.totalEarningPaise))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="mb-2 mt-5 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Ledger — day by day</p>
          {data.daily.length === 0 ? (
            <p className="text-sm text-graphite-400">No ledger entries this month.</p>
          ) : (
            <ul className="divide-y divide-steel-100 rounded-lg border border-steel-200">
              {data.daily.map((day) => {
                const open = openDay === day.date;
                return (
                  <li key={day.date}>
                    <button
                      type="button"
                      onClick={() => setOpenDay(open ? null : day.date)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-steel-100/60"
                      aria-expanded={open}
                    >
                      <span className="text-sm font-medium text-graphite-900">{formatDate(day.date)}</span>
                      <span className="flex items-center gap-3">
                        <span className={cx("text-sm font-semibold tabular-nums", day.netPaise < 0 ? "text-rust" : "text-teal")}>
                          {day.netPaise < 0 ? "−" : "+"}
                          {formatINR(Math.abs(rupees(day.netPaise)))}
                        </span>
                        <ChevronDown size={14} className={cx("text-graphite-300 transition-transform duration-200", open && "rotate-180")} />
                      </span>
                    </button>
                    {open && (
                      <ul className="space-y-1 bg-steel-100/40 px-3 py-2">
                        {day.entries.map((e, i) => (
                          <li key={e.id ?? i} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-graphite-700">
                              <span className="mr-2 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-graphite-500">{e.type.replace(/_/g, " ")}</span>
                              {e.description}
                            </span>
                            <span className={cx("font-semibold tabular-nums", e.direction === "DEBIT" ? "text-rust" : "text-teal")}>
                              {e.direction === "DEBIT" ? "−" : "+"}
                              {formatINR(rupees(e.amountPaise))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {dataUpdatedAt ? <p className="mt-2 text-right text-[10px] text-graphite-300">Updated {new Date(dataUpdatedAt).toLocaleTimeString("en-IN")}</p> : null}
        </>
      )}
    </section>
  );
}

function formatMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

function Bar({ label, value, pctValue, tone }) {
  const color = { teal: "bg-teal", rust: "bg-rust", amber: "bg-amber", graphite: "bg-graphite-500" }[tone];
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-graphite-500">{label}</span>
        <span className="font-semibold tabular-nums text-graphite-900">{value < 0 ? `−${formatINR(Math.abs(rupees(value)))}` : formatINR(rupees(value))}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-steel-100">
        <div className={cx("h-full rounded-full transition-[width] duration-500 ease-out", color)} style={{ width: `${pctValue}%` }} />
      </div>
    </div>
  );
}
