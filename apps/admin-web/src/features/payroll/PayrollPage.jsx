import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { formatINR, formatDate } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

function paise(v) {
  return formatINR(Math.round(v / 100));
}

function usePayrollMonth(month) {
  return useQuery({
    queryKey: ["payroll", month],
    queryFn: async () => unwrap(api.get(`/payroll/${month}`)),
  });
}

function useSitesForSelect() {
  return useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites")),
  });
}

export function PayrollPage() {
  const toast = useToast();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [siteFilter, setSiteFilter] = useState("");
  const { data, isLoading } = usePayrollMonth(month);
  const { data: sites } = useSitesForSelect();
  const qc = useQueryClient();

  useSocketInvalidate("salary:ledger_updated", [["payroll", month]]);
  useSocketInvalidate("salary:month_finalized", [["payroll", month]]);
  useSocketInvalidate("attendance:created", [["payroll", month]]);
  useSocketInvalidate("attendance:updated", [["payroll", month]]);
  useSocketInvalidate("attendance:deleted", [["payroll", month]]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["payroll", month] });

  const calculate = useMutation({
    mutationFn: async () => unwrap(api.post(`/payroll/${month}/calculate`)),
    onSuccess: (results) => {
      invalidate();
      const errors = (results ?? []).filter((r) => r.status === "ERROR");
      if (errors.length > 0) {
        toast.info(`Payroll calculated for ${((results ?? []).length - errors.length)} worker(s); ${errors.length} could not be recalculated (finalized or paid).`);
      } else {
        toast.success(`Payroll calculated for ${((results ?? []).length)} worker(s) for ${month}.`);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Calculation failed."),
  });
  const finalize = useMutation({
    mutationFn: async () => unwrap(api.post(`/payroll/${month}/finalize`)),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Month ${month} finalized for ${result?.finalizedCount ?? 0} worker(s). Attendance for the month is now locked.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Finalization failed."),
  });
  const markPaid = useMutation({
    mutationFn: async () => unwrap(api.post(`/payroll/${month}/mark-paid`)),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Marked ${result?.paidCount ?? 0} worker(s) as PAID for ${month}. Workers have been notified.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Mark-paid failed."),
  });

  // --- Salary adjustment (bonus / deduction) ---
  const { data: activeWorkers } = useQuery({
    queryKey: ["workers", "active-for-payroll"],
    queryFn: async () => unwrap(api.get("/workers?verificationStatus=ACTIVE&pageSize=100")),
  });
  const [showAdj, setShowAdj] = useState(false);
  const [adjForm, setAdjForm] = useState({ workerId: "", siteId: "", amountRupees: "", description: "" });
  const postAdjustment = useMutation({
    mutationFn: async (input) => unwrap(api.post("/payroll/adjustments", input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll", month] });
      toast.success(`Adjustment posted for ${month}. Payroll recalculated.`);
      setAdjForm({ workerId: "", siteId: "", amountRupees: "", description: "" });
      setShowAdj(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Adjustment failed."),
  });

  // --- Worker ledger drill-down ---
  const [ledgerWorker, setLedgerWorker] = useState("");
  const { data: ledger } = useQuery({
    queryKey: ["salary", "ledger", ledgerWorker, month],
    queryFn: async () => unwrap(api.get(`/salary/worker/${ledgerWorker}/ledger?from=${month}-01&to=${month}-31`)),
    enabled: Boolean(ledgerWorker),
  });
  const { data: workerSummary } = useQuery({
    queryKey: ["salary", "summary", ledgerWorker, month],
    queryFn: async () => unwrap(api.get(`/salary/worker/${ledgerWorker}/summary?month=${month}`)),
    enabled: Boolean(ledgerWorker),
  });
  const { data: dayStatement } = useQuery({
    queryKey: ["salary", "statement", ledgerWorker, month],
    queryFn: async () => unwrap(api.get(`/salary/worker/${ledgerWorker}/statement?month=${month}`)),
    enabled: Boolean(ledgerWorker),
  });

  const rows = data ?? [];
  const filtered = siteFilter ? rows.filter((r) => r.worker?.currentSite?._id === siteFilter || r.worker?.currentSite === siteFilter) : rows;

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.grossEarningsPaise,
      overtime: acc.overtime + r.overtimeEarningsPaise,
      deductions: acc.deductions + r.advanceDeductionsPaise + r.kharchiDeductionsPaise + r.otherDeductionsPaise,
      net: acc.net + r.netSalaryPaise,
    }),
    { gross: 0, overtime: 0, deductions: 0, net: 0 },
  );

  const fmtH = (v) => {
    const n = Math.round((Number(v) || 0) * 10) / 10;
    return Number.isInteger(n) ? String(n) : String(n);
  };
  // Attendance summary in plain words + ACTUAL hours. A day marked PRESENT
  // for only 6 hours reads "1 Present · 6h worked" — never a bare "1P",
  // which looked like a full day even though pay was pro-rated (₹563).
  const daysCell = (r) => {
    const parts = [];
    if (r.presentDays) parts.push(`${r.presentDays} Present`);
    if (r.halfDays) parts.push(`${r.halfDays} Half`);
    if (r.paidLeaveDays) parts.push(`${r.paidLeaveDays} Paid leave`);
    if (r.absentDays) parts.push(`${r.absentDays} Absent (AB)`);
    if (r.unpaidLeaveDays) parts.push(`${r.unpaidLeaveDays} Unpaid leave`);
    if (r.totalHoursWorked) parts.push(`${fmtH(r.totalHoursWorked)}h worked`);
    else if (r.overtimeHours) parts.push(`${fmtH(r.overtimeHours)}h OT`);
    if (r.overtimeHours && r.totalHoursWorked) parts.push(` incl. ${fmtH(r.overtimeHours)}h OT`);
    return parts.length > 0 ? parts.join(" · ") : "—";
  };

  const [receiptFor, setReceiptFor] = useState(null); // payroll row being marked paid
  const [receiptForm, setReceiptForm] = useState({ transactionId: "", ocrText: "", note: "" });
  const [receiptFile, setReceiptFile] = useState(null);
  const [ocr, setOcr] = useState(null);
  const runOcr = useMutation({
    mutationFn: async (text) => unwrap(api.post("/payroll/receipts/ocr-preview", { text })),
    onSuccess: (data) => {
      setOcr(data);
      if (data?.transactionId) setReceiptForm((f) => ({ ...f, transactionId: data.transactionId }));
      toast.success(`OCR read: ${data?.amountPaise ? paise(data.amountPaise) : "no amount"}${data?.transactionId ? ` · Txn ${data.transactionId}` : ""}${data?.paidAt ? ` · ${formatDate(data.paidAt)}` : ""}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "OCR failed.")
  });
  const markWorkerPaid = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      if (receiptFile) fd.append("file", receiptFile);
      fd.append("method", "UPI");
      if (receiptForm.transactionId) fd.append("transactionId", receiptForm.transactionId);
      if (receiptForm.ocrText) fd.append("ocrText", receiptForm.ocrText);
      if (receiptForm.note) fd.append("note", receiptForm.note);
      const workerId = receiptFor.worker?._id ?? receiptFor.worker;
      return unwrap(api.post(`/payroll/${month}/workers/${workerId}/mark-paid`, fd));
    },
    onSuccess: () => {
      invalidate();
      setReceiptFor(null); setReceiptFile(null); setOcr(null);
      setReceiptForm({ transactionId: "", ocrText: "", note: "" });
      toast.success("Worker marked paid — receipt saved. The worker can now see it as salary proof.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not mark paid.")
  });

  const columns = [
    { header: "Employee ID", cell: (r) => r.worker?.employeeId },
    { header: "Worker", cell: (r) => r.worker?.user?.name ?? "—", className: "font-body" },
    {
      header: "Site",
      cell: (r) => r.worker?.currentSite?.name ?? "—",
      className: "font-body",
    },
    { header: "Attendance (days + hours)", cell: daysCell, className: "whitespace-normal" },
    { header: "Gross", cell: (r) => paise(r.grossEarningsPaise) },
    { header: "Overtime", cell: (r) => paise(r.overtimeEarningsPaise) },
    { header: "Advance ded.", cell: (r) => paise(r.advanceDeductionsPaise), className: "text-rust" },
    { header: "Kharchi ded.", cell: (r) => paise(r.kharchiDeductionsPaise), className: "text-rust" },
    { header: "Other ded.", cell: (r) => paise(r.otherDeductionsPaise), className: "text-rust" },
    { header: "Net salary", cell: (r) => paise(r.netSalaryPaise), className: "font-semibold" },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: "",
      cell: (r) => (
        <span className="flex gap-3">
          <button
            className="text-xs font-medium text-amber-600 hover:underline"
            onClick={() => setLedgerWorker(r.worker?._id ?? r.worker)}
          >
            Days &amp; ledger
          </button>
          {r.status === "FINALIZED" && (
            <button
              className="text-xs font-medium text-teal hover:underline"
              onClick={() => setReceiptFor(r)}
            >
              Mark paid + receipt
            </button>
          )}
        </span>
      ),
    },
  ];

  const ledgerColumns = [
    { header: "Date", cell: (e) => formatDate(e.date) },
    { header: "Type", cell: (e) => e.type.replace(/_/g, " "), className: "font-body" },
    { header: "Description", cell: (e) => e.description ?? "—", className: "font-body text-xs" },
    { header: "Credit", cell: (e) => (e.credit ? formatINR(e.credit) : "—"), className: "text-teal" },
    { header: "Debit", cell: (e) => (e.debit ? formatINR(e.debit) : "—"), className: "text-rust" },
    { header: "Balance", cell: (e) => formatINR(e.runningBalance), className: "font-mono" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Payroll</h1>
          <p className="text-sm text-graphite-500">Per-worker monthly payment from attendance — gross + overtime − deductions = net. Finalize to lock the month, then mark paid.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input max-w-[12rem]" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="">All sites</option>
            {sites?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          <input type="month" className="input max-w-[10rem]" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Workers" value={String(rows.length)} sublabel={siteFilter ? `${filtered.length} in selected site` : undefined} />
        <KpiCard label="Gross + overtime" value={formatINR(Math.round((totals.gross + totals.overtime) / 100))} tone="positive" />
        <KpiCard label="Total deductions" value={formatINR(Math.round(totals.deductions / 100))} tone="negative" sublabel="Advances + kharchi + other" />
        <KpiCard label="Net payable" value={formatINR(Math.round(totals.net / 100))} sublabel="What workers are paid this month" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => calculate.mutate()} disabled={calculate.isPending}>
          {calculate.isPending ? "Calculating…" : "Calculate month"}
        </button>
        <button className="btn-accent" onClick={() => finalize.mutate()} disabled={finalize.isPending}>
          {finalize.isPending ? "Finalizing…" : "Finalize month"}
        </button>
        <button className="btn-ghost" onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
          {markPaid.isPending ? "Marking…" : "Mark paid"}
        </button>
        <button className="btn-ghost ml-auto" onClick={() => setShowAdj((v) => !v)}>
          {showAdj ? "Cancel" : "Add adjustment (bonus/deduction)"}
        </button>
      </div>

      {showAdj && (
        <form
          className="card grid gap-3 p-4 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adjForm.workerId || !adjForm.siteId || !adjForm.amountRupees || !adjForm.description.trim()) {
              toast.error("Worker, site, amount and description are required.");
              return;
            }
            postAdjustment.mutate({
              workerId: adjForm.workerId,
              siteId: adjForm.siteId,
              amountRupees: Number(adjForm.amountRupees),
              description: adjForm.description.trim(),
            });
          }}
        >
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Worker *</label>
            <select className="input" required value={adjForm.workerId} onChange={(e) => setAdjForm({ ...adjForm, workerId: e.target.value })}>
              <option value="">Select worker…</option>
              {(activeWorkers?.items ?? activeWorkers ?? []).map((w) => (
                <option key={w._id} value={w._id}>
                  {w.user?.name ?? w.employeeId} — {w.employeeId}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Site *</label>
            <select className="input" required value={adjForm.siteId} onChange={(e) => setAdjForm({ ...adjForm, siteId: e.target.value })}>
              <option value="">Select site…</option>
              {sites?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Amount (₹) *</label>
            <input
              className="input"
              type="number"
              required
              placeholder="e.g. 500 or -1000 for bonus"
              value={adjForm.amountRupees}
              onChange={(e) => setAdjForm({ ...adjForm, amountRupees: e.target.value })}
            />
            <p className="mt-1 text-xs text-graphite-400">Positive = deduction, negative = bonus/credit.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Description *</label>
            <input
              className="input"
              required
              placeholder="e.g. Festival bonus"
              value={adjForm.description}
              onChange={(e) => setAdjForm({ ...adjForm, description: e.target.value })}
            />
          </div>
          <div className="md:col-span-4">
            <button type="submit" className="btn-primary" disabled={postAdjustment.isPending}>
              {postAdjustment.isPending ? "Posting…" : "Post adjustment"}
            </button>
          </div>
        </form>
      )}

      {receiptFor && (
        <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); markWorkerPaid.mutate(); }}>
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500 md:col-span-2">
            Mark paid — {receiptFor.worker?.user?.name ?? receiptFor.worker?.employeeId} · net {paise(receiptFor.netSalaryPaise)} · {month}
          </p>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">UPI / bank receipt image (screenshot)</label>
            <input className="input" type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Transaction ID / UTR (from receipt)</label>
            <input className="input" placeholder="e.g. 412345678901" value={receiptForm.transactionId} onChange={(e) => setReceiptForm({ ...receiptForm, transactionId: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-graphite-500">
              OCR — paste the text read from the receipt image (phone OCR / screenshot text). Amount, date, time and transaction ID are extracted automatically.
            </label>
            <textarea className="input" rows={3} placeholder="Paste receipt text here, then click Run OCR…" value={receiptForm.ocrText} onChange={(e) => setReceiptForm({ ...receiptForm, ocrText: e.target.value })} />
            <div className="mt-2 flex items-center gap-3">
              <button type="button" className="btn-ghost" disabled={!receiptForm.ocrText || runOcr.isPending} onClick={() => runOcr.mutate(receiptForm.ocrText)}>
                {runOcr.isPending ? "Reading…" : "Run OCR"}
              </button>
              {ocr && (
                <span className="text-xs text-graphite-500">
                  Detected: {ocr.amountPaise ? paise(ocr.amountPaise) : "—"} · {ocr.transactionId ?? "no txn id"} ·{" "}
                  {ocr.paidAt ? formatDate(ocr.paidAt) : "no date"} {ocr.time ?? ""} · confidence {Math.round((ocr.confidence ?? 0) * 100)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-accent" disabled={markWorkerPaid.isPending}>
              {markWorkerPaid.isPending ? "Saving…" : "Confirm paid & save receipt"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setReceiptFor(null)}>Cancel</button>
          </div>
        </form>
      )}

      <DataTable columns={columns} rows={filtered} isLoading={isLoading} emptyTitle="No payroll calculated yet" emptyBody={`Click "Calculate month" to generate payroll for ${month} from recorded attendance.`} />

      <p className="text-xs text-graphite-500">
        How every amount is calculated: <strong>Gross</strong> = Σ daily earnings — each attendance day pays (hours worked ÷ full-day hours) × daily rate, so a day marked PRESENT for only 6 hours at ₹750/day pays 6h × ₹93.75/hr = ₹562.50 (shown as ₹563), not a full ₹750 — open <strong>Days &amp; ledger</strong> on any worker to see every day (AB, 1h, 2h, 6h, 8h full day, overtime) with its exact calculation. PRESENT with no hours recorded and LEAVE_PAID count as a full day, HALF_DAY is pro-rated from hours, ABSENT/LEAVE_UNPAID earn nothing. <strong>Overtime</strong> = hours beyond the overtime threshold × hourly rate × overtime multiplier. <strong>Net</strong> = Gross + Overtime − Advance − Kharchi − Other deductions. Corrections/deletions reverse the affected ledger entries first, so figures always match the underlying attendance.
      </p>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Worker salary ledger — drill-down (salary.read)</p>
          {ledgerWorker && (
            <button className="text-xs text-graphite-500 hover:underline" onClick={() => setLedgerWorker("")}>
              Clear
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <select className="input max-w-xs" value={ledgerWorker} onChange={(e) => setLedgerWorker(e.target.value)}>
            <option value="">Select a worker to view ledger…</option>
            {rows.map((r) => (
              <option key={r.worker?._id ?? r.worker} value={r.worker?._id ?? r.worker}>
                {r.worker?.user?.name ?? r.worker?.employeeId} — {r.worker?.employeeId}
              </option>
            ))}
          </select>
          {workerSummary && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-steel-100 px-2 py-1">Status: <StatusBadge status={workerSummary.status} /></span>
              <span className="rounded bg-steel-100 px-2 py-1">Gross: {formatINR(workerSummary.grossEarnings)}</span>
              <span className="rounded bg-steel-100 px-2 py-1">Net: {formatINR(workerSummary.netSalary)}</span>
            </div>
          )}
        </div>
        {ledgerWorker && dayStatement?.dailyAttendance && (
          <div className="mt-4 rounded-xl border border-steel-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-steel-200 bg-steel-50 px-3 py-2">
              <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Day-by-day attendance &amp; how each day&apos;s pay was calculated</p>
              {dayStatement.salaryRates && (
                <p className="text-xs text-graphite-500">
                  Rate: <span className="font-medium text-graphite-900">{paise(dayStatement.salaryRates.dailyRatePaise)}/day</span> · {paise(dayStatement.salaryRates.hourlyRatePaise)}/hr ({dayStatement.salaryRates.fullDayHours}h = full day)
                </p>
              )}
            </div>
            {dayStatement.dailyAttendance.length === 0 ? (
              <p className="px-3 py-3 text-sm text-graphite-500">No attendance marked for this worker in {month} yet.</p>
            ) : (
              <ul className="divide-y divide-steel-100">
                {dayStatement.dailyAttendance.map((d) => (
                  <li key={d.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="min-w-24 font-medium text-graphite-900">{formatDate(d.date)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.totalEarningPaise > 0 ? "bg-teal-50 text-teal" : "bg-red-50 text-rust"}`}>{d.label}</span>
                    <span className="flex-1 text-xs text-graphite-500">{d.calculation}</span>
                    <span className="font-mono font-semibold tabular-nums text-graphite-900">{paise(d.totalEarningPaise)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-steel-100 px-3 py-2 text-[11px] text-graphite-400">Day pay is before that day&apos;s advance/Kharchi deductions — see the ledger below for debits and the running balance. Example: a 6h day at ₹750/day (₹93.75/hr) pays 6 × ₹93.75 = ₹562.50, shown rounded as ₹563.</p>
          </div>
        )}
        {ledgerWorker ? (
          <div className="mt-4">
            <DataTable columns={ledgerColumns} rows={ledger} isLoading={false} emptyTitle="No ledger entries" emptyBody="This worker has no salary ledger entries for the selected month." />
          </div>
        ) : (
          <p className="mt-3 text-sm text-graphite-500">Pick a worker from the payroll table (Ledger button) or dropdown to see daily credits/debits and running balance.</p>
        )}
      </div>
    </div>
  );
}
