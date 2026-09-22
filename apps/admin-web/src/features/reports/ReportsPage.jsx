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

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const downloadCsv = async () => {
    // window.open() sends no Authorization header, so the API answers 401.
    // Download through the authed client as a blob instead (same pattern as
    // the finance export bar).
    setExporting(true);
    setExportError("");
    try {
      const qs = new URLSearchParams({ ...params, format: "csv" }).toString();
      const res = await api.get(`/reports/${type}?${qs}`, { responseType: "blob" });
      const contentType = String(res.headers?.["content-type"] || "");
      if (contentType.includes("application/json")) {
        const body = JSON.parse(await res.data.text());
        throw new Error(body?.error?.message || "Could not export the report.");
      }
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ananta-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not export the report.");
    } finally {
      setExporting(false);
    }
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
        <div className="flex flex-col items-end gap-1">
          <button className="btn-ghost" onClick={downloadCsv} disabled={exporting}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          {exportError && <p className="text-xs text-rust">{exportError}</p>}
        </div>
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