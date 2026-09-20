import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { formatINR } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

function paise(v) {
  return formatINR(Math.round(v / 100));
}

function usePayrollMonth(month) {
  return useQuery({
    queryKey: ["payroll", month],
    queryFn: async () => unwrap(api.get(`/payroll/${month}`))
  });
}

function useSitesForSelect() {
  return useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites"))
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
    onError: (err) => toast.error(err instanceof Error ? err.message : "Calculation failed.")
  });
  const finalize = useMutation({
    mutationFn: async () => unwrap(api.post(`/payroll/${month}/finalize`)),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Month ${month} finalized for ${result?.finalizedCount ?? 0} worker(s). Attendance for the month is now locked.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Finalization failed.")
  });
  const markPaid = useMutation({
    mutationFn: async () => unwrap(api.post(`/payroll/${month}/mark-paid`)),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Marked ${result?.paidCount ?? 0} worker(s) as PAID for ${month}. Workers have been notified.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Mark-paid failed.")
  });

  const rows = data ?? [];
  const filtered = siteFilter ? rows.filter((r) => r.worker?.currentSite?._id === siteFilter || r.worker?.currentSite === siteFilter) : rows;

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.grossEarningsPaise,
      overtime: acc.overtime + r.overtimeEarningsPaise,
      deductions:
      acc.deductions + r.advanceDeductionsPaise + r.kharchiDeductionsPaise + r.otherDeductionsPaise,
      net: acc.net + r.netSalaryPaise
    }),
    { gross: 0, overtime: 0, deductions: 0, net: 0 }
  );

  const daysCell = (r) => {
    const parts = [];
    if (r.presentDays) parts.push(`${r.presentDays}P`);
    if (r.halfDays) parts.push(`${r.halfDays}H`);
    if (r.paidLeaveDays) parts.push(`${r.paidLeaveDays}PL`);
    if (r.absentDays) parts.push(`${r.absentDays}A`);
    if (r.unpaidLeaveDays) parts.push(`${r.unpaidLeaveDays}UL`);
    if (r.overtimeHours) parts.push(`${r.overtimeHours}h OT`);
    return parts.length > 0 ? parts.join(" · ") : "—";
  };

  const columns = [
  { header: "Employee ID", cell: (r) => r.worker?.employeeId },
  { header: "Worker", cell: (r) => r.worker?.user?.name ?? "—", className: "font-body" },
  {
    header: "Site",
    cell: (r) => r.worker?.currentSite?.name ?? "—",
    className: "font-body"
  },
  { header: "Days (P·H·PL·A·UL·OT)", cell: daysCell, className: "whitespace-normal" },
  { header: "Gross", cell: (r) => paise(r.grossEarningsPaise) },
  { header: "Overtime", cell: (r) => paise(r.overtimeEarningsPaise) },
  { header: "Advance ded.", cell: (r) => paise(r.advanceDeductionsPaise), className: "text-rust" },
  { header: "Kharchi ded.", cell: (r) => paise(r.kharchiDeductionsPaise), className: "text-rust" },
  { header: "Other ded.", cell: (r) => paise(r.otherDeductionsPaise), className: "text-rust" },
  { header: "Net salary", cell: (r) => paise(r.netSalaryPaise), className: "font-semibold" },
  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Payroll</h1>
          <p className="text-sm text-graphite-500">
            Per-worker monthly payment from attendance — gross + overtime − deductions = net. Finalize
            to lock the month, then mark paid.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input max-w-[12rem]" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="">All sites</option>
            {sites?.map((s) =>
            <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            )}
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
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        isLoading={isLoading}
        emptyTitle="No payroll calculated yet"
        emptyBody={`Click "Calculate month" to generate payroll for ${month} from recorded attendance.`} />

      <p className="text-xs text-graphite-500">
        How every amount is calculated: <strong>Gross</strong> = Σ daily earnings — each attendance day pays
        (hours worked ÷ full-day hours) × daily rate; PRESENT/LEAVE_PAID count as a full day, HALF_DAY is
        pro-rated from hours, ABSENT/LEAVE_UNPAID earn nothing. <strong>Overtime</strong> = hours beyond the
        overtime threshold × hourly rate × overtime multiplier. <strong>Net</strong> = Gross + Overtime −
        Advance − Kharchi − Other deductions. Corrections/deletions reverse the affected ledger entries
        first, so figures always match the underlying attendance.
      </p>
    </div>);

}
