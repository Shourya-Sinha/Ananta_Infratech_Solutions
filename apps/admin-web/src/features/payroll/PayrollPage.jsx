import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
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

export function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const { data, isLoading } = usePayrollMonth(month);
  const qc = useQueryClient();

  useSocketInvalidate("salary:ledger_updated", [["payroll", month]]);
  useSocketInvalidate("salary:month_finalized", [["payroll", month]]);

  const calculate = useMutation({
    mutationFn: async () => unwrap(api.post(`/payroll/${month}/calculate`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll", month] })
  });
  const finalize = useMutation({
    mutationFn: async () => unwrap(api.post(`/payroll/${month}/finalize`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll", month] })
  });
  const markPaid = useMutation({
    mutationFn: async () => unwrap(api.post(`/payroll/${month}/mark-paid`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll", month] })
  });

  const totals = (data ?? []).reduce(
    (acc, r) => ({ gross: acc.gross + r.grossEarningsPaise, net: acc.net + r.netSalaryPaise }),
    { gross: 0, net: 0 }
  );

  const columns = [
  { header: "Employee ID", cell: (r) => r.worker?.employeeId },
  { header: "Gross", cell: (r) => paise(r.grossEarningsPaise) },
  { header: "Overtime", cell: (r) => paise(r.overtimeEarningsPaise) },
  { header: "Advance ded.", cell: (r) => paise(r.advanceDeductionsPaise), className: "text-rust" },
  { header: "Kharchi ded.", cell: (r) => paise(r.kharchiDeductionsPaise), className: "text-rust" },
  { header: "Net salary", cell: (r) => paise(r.netSalaryPaise), className: "font-semibold" },
  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Payroll</h1>
          <p className="text-sm text-graphite-500">
            {data ? `${data.length} workers · Gross ${paise(totals.gross)} · Net ${paise(totals.net)}` : "—"}
          </p>
        </div>
        <input type="month" className="input max-w-[10rem]" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => calculate.mutate()} disabled={calculate.isPending}>
          Calculate month
        </button>
        <button className="btn-accent" onClick={() => finalize.mutate()} disabled={finalize.isPending}>
          Finalize month
        </button>
        <button className="btn-ghost" onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
          Mark paid
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        emptyTitle="No payroll calculated yet"
        emptyBody={`Click "Calculate month" to generate payroll for ${month} from recorded attendance.`} />
      
    </div>);

}