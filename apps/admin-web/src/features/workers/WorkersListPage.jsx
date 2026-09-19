import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkers } from "./api";
import { DataTable } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

const VERIFICATION_FILTERS = [
{ value: "", label: "All statuses" },
{ value: "PENDING_VERIFICATION", label: "Pending verification" },
{ value: "DOCUMENT_VERIFIED", label: "Document verified" },
{ value: "WORK_TYPE_VERIFIED", label: "Work type verified" },
{ value: "ACTIVE", label: "Active" },
{ value: "REJECTED", label: "Rejected" }];

export function WorkersListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Reads ?status=ACTIVE etc from the URL so dashboard KPI cards can deep-link
  // straight into a pre-filtered view instead of a generic list.
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [search, setSearch] = useState("");

  const filters = {};
  if (status) filters.verificationStatus = status;
  if (search) filters.search = search;

  const { data, isLoading } = useWorkers(filters);
  useSocketInvalidate("worker:verification_updated", [["workers"]]);
  useSocketInvalidate("worker:created", [["workers"]]);
  useSocketInvalidate("worker:site_assigned", [["workers"]]);

  const columns = [
  { header: "Employee ID", cell: (w) => w.employeeId },
  { header: "Name", cell: (w) => w.user?.name, className: "font-body" },
  { header: "Phone", cell: (w) => w.user?.phone },
  { header: "Work type", cell: (w) => w.workType?.name ?? "—", className: "font-body" },
  { header: "Site", cell: (w) => w.currentSite?.name ?? "Unassigned", className: "font-body" },
  { header: "Status", cell: (w) => <StatusBadge status={w.verificationStatus} /> }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-graphite-900">Workers</h1>
          <p className="text-sm text-graphite-500">{data?.total ?? 0} total</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)} />
        
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          {VERIFICATION_FILTERS.map((f) =>
          <option key={f.value} value={f.value}>
              {f.label}
            </option>
          )}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        emptyTitle="No workers found"
        emptyBody="Workers appear here once registration begins from the mobile app."
        onRowClick={(w) => navigate(`/workers/${w._id}`)} />
      
    </div>);

}