import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";

export function ReportsPage() {
  const [type, setType] = useState("attendance");
  const [site, setSite] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: sites } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites"))
  });

  const params = type === "attendance" ? { site } : type === "payroll" ? { month } : { site };

  const { data, isLoading } = useQuery({
    queryKey: ["reports", type, params],
    queryFn: async () => {
      const qs = new URLSearchParams(params).toString();
      return unwrap(api.get(`/reports/${type}?${qs}`));
    },
    enabled: type === "payroll" ? Boolean(month) : Boolean(site)
  });

  const downloadCsv = () => {
    const qs = new URLSearchParams(params).toString();
    window.open(`/api/v1/reports/${type}?${qs}&format=csv`, "_blank");
  };

  const columns =
  data && data.length > 0 ?
  Object.keys(data[0]).map((key) => ({
    header: key.replace(/([A-Z])/g, " $1").trim(),
    cell: (row) => String(row[key] ?? "—")
  })) :
  [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Reports</h1>
          <p className="text-sm text-graphite-500">Attendance, payroll, and site finance summaries.</p>
        </div>
        <button className="btn-ghost" onClick={downloadCsv}>
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex rounded border border-steel-200 bg-surface p-0.5">
          {["attendance", "payroll", "site-finance"].map((t) =>
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded px-3 py-1.5 text-sm capitalize transition-colors duration-150 ${
            type === t ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`
            }>
            
              {t.replace("-", " ")}
            </button>
          )}
        </div>

        {type === "payroll" ?
        <input type="month" className="input max-w-[10rem]" value={month} onChange={(e) => setMonth(e.target.value)} /> :

        <select className="input max-w-xs" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">Select a site…</option>
            {sites?.map((s) =>
          <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
          )}
          </select>
        }
      </div>

      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        emptyTitle="No data for this report"
        emptyBody="Adjust the filters above to generate a report." />
      
    </div>);

}