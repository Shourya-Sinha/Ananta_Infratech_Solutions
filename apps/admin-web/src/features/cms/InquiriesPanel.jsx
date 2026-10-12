import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCmsInquiries, updateInquiryStatus } from "@/features/cms/api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";

const KIND_FILTERS = [
  { value: "", label: "All" },
  { value: "CONTACT", label: "Contact enquiries" },
  { value: "CAREER_CONTRACTOR", label: "Contractor interest" },
  { value: "CAREER_WORKER", label: "Worker interest" }
];

const KIND_LABEL = {
  CONTACT: "Contact enquiry",
  CAREER_CONTRACTOR: "Contractor interest",
  CAREER_WORKER: "Worker interest"
};

const STATUS_CLASS = {
  NEW: "bg-amber-50 text-amber-600",
  CONTACTED: "bg-teal-50 text-teal",
  CLOSED: "bg-steel-100 text-graphite-500"
};

function details(item) {
  const parts = [];
  if (item.service) parts.push(`Service: ${item.service}`);
  if (item.company) parts.push(`Company: ${item.company}`);
  if (item.trade) parts.push(`Trade: ${item.trade}`);
  if (item.experienceYears !== undefined) parts.push(`Experience: ${item.experienceYears} yrs`);
  if (item.city) parts.push(`City: ${item.city}`);
  return parts;
}

export function InquiriesPanel() {
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const { data, isLoading, error } = useCmsInquiries({ kind, status });
  const qc = useQueryClient();
  const toast = useToast();

  const update = useMutation({
    mutationFn: ({ id, nextStatus }) => updateInquiryStatus(id, nextStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cms", "inquiries"] });
      toast.success("Enquiry status updated.");
    },
    onError: (err) => toast.error(err.message)
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => setKind(f.value)}
              aria-pressed={kind === f.value}
              className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${kind === f.value ? "border-amber bg-amber-50 text-amber-600" : "border-steel-200 bg-white text-graphite-700"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <select className="input !w-auto !py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-graphite-500">Loading enquiries…</p>}
      {error && <p className="text-sm text-rust">{error.message}</p>}

      {data && data.length === 0 && (
        <div className="card p-10 text-center text-sm text-graphite-500">No website enquiries yet. Contact and careers forms will appear here.</div>
      )}

      {data && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-steel-200 text-xs uppercase tracking-wide text-graphite-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Received</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Name & contact</th>
                <th className="px-4 py-3 font-semibold">Details</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-200">
              {data.map((item) => (
                <tr key={item._id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-graphite-500">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-graphite-900">{KIND_LABEL[item.kind] || item.kind}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-graphite-900">{item.name}</p>
                    <p className="font-mono text-xs text-graphite-500">{item.phone}</p>
                    {item.email && <p className="text-xs text-graphite-500">{item.email}</p>}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    {details(item).map((line) => (
                      <p key={line} className="text-xs text-graphite-500">
                        {line}
                      </p>
                    ))}
                    {item.message && <p className="mt-1 whitespace-pre-line text-graphite-700">{item.message}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className={`rounded-sm px-2.5 py-1.5 text-xs font-semibold ${STATUS_CLASS[item.status] || ""}`}
                      value={item.status}
                      disabled={update.isPending}
                      onChange={(e) => update.mutate({ id: item._id, nextStatus: e.target.value })}
                      aria-label="Enquiry status">
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
