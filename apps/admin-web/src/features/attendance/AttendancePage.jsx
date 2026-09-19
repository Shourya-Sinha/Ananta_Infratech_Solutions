import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";
import { formatDate } from "@/lib/format";

function useSitesForSelect() {
  return useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites"))
  });
}

function useAttendance(filters) {
  const qs = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ["attendance", filters],
    queryFn: async () => unwrap(api.get(`/attendance?${qs}`)),
    enabled: Boolean(filters.site && filters.from && filters.to)
  });
}

export function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [site, setSite] = useState("");
  const [date, setDate] = useState(today);

  const { data: sites } = useSitesForSelect();
  const { data, isLoading } = useAttendance(site ? { site, from: date, to: date } : {});
  useSocketInvalidate("attendance:created", [["attendance"]]);
  useSocketInvalidate("attendance:updated", [["attendance"]]);

  const columns = [
  { header: "Employee ID", cell: (a) => a.worker?.employeeId },
  { header: "Site", cell: (a) => a.site?.name, className: "font-body" },
  { header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
  { header: "Hours", cell: (a) => a.hoursWorked },
  { header: "Overtime", cell: (a) => a.overtimeHours }];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Attendance</h1>
        <p className="text-sm text-graphite-500">
          Attendance is normally recorded from the Manager mobile app; this view is for admin oversight and corrections.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="input max-w-xs" value={site} onChange={(e) => setSite(e.target.value)}>
          <option value="">Select a site…</option>
          {sites?.map((s) =>
          <option key={s._id} value={s._id}>
              {s.name} ({s.code})
            </option>
          )}
        </select>
        <input type="date" className="input max-w-xs" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {!site ?
      <p className="rounded border border-dashed border-steel-200 p-6 text-center text-sm text-graphite-500">
          Select a site to view attendance for {formatDate(date)}.
        </p> :

      <DataTable
        columns={columns}
        rows={data}
        isLoading={isLoading}
        emptyTitle="No attendance recorded"
        emptyBody={`No attendance has been marked for this site on ${formatDate(date)} yet.`} />

      }
    </div>);

}