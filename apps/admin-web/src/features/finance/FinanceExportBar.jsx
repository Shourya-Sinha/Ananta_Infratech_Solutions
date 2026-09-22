import { useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useToast } from "@/components/ui/Toast";

const FORMATS = [
  { id: "pdf", label: "PDF", ext: "pdf" },
  { id: "doc", label: "Word (.doc)", ext: "doc" },
  { id: "xls", label: "Excel (.xls)", ext: "xls" }
];

function fallbackName(format, from, to) {
  const ext = FORMATS.find((item) => item.id === format)?.ext || "pdf";
  const day = new Date().toISOString().slice(0, 10);
  if (from || to) return `ananta-finance-${from || "start"}_to_${to || "end"}-${day}.${ext}`;
  return `ananta-finance-all-dates-${day}.${ext}`;
}

function filenameFromHeader(header, fallback) {
  if (!header) return fallback;
  const plain = header.match(/filename="([^"]+)"/i);
  return plain?.[1] || fallback;
}

async function errorMessage(error) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      return body?.error?.message || "Could not export the finance file.";
    } catch {
      return "Could not export the finance file.";
    }
  }
  if (error?.code === "ECONNABORTED") return "The export took too long. Try a shorter date range.";
  return error?.message || "Could not export the finance file.";
}

export function FinanceExportBar() {
  const toast = useToast();
  const [format, setFormat] = useState("pdf");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rangeInvalid = Boolean(from && to && from > to);

  async function download() {
    if (rangeInvalid) {
      setError("The start date must be on or before the end date.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.get("/finance/export", {
        params: {
          format,
          ...(from ? { from } : {}),
          ...(to ? { to } : {})
        },
        responseType: "blob",
        timeout: 120000
      });
      const type = String(res.headers["content-type"] || "");
      if (type.includes("application/json")) {
        const body = JSON.parse(await res.data.text());
        throw new Error(body?.error?.message || "Could not export the finance file.");
      }
      const filename = filenameFromHeader(res.headers["content-disposition"], fallbackName(format, from, to));
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Finance file downloaded.");
    } catch (err) {
      const message = await errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Export</p>
          <h2 className="font-display text-base font-semibold text-graphite-900">Download one finance file</h2>
          <p className="mt-1 text-sm text-graphite-500">
            Sections stay separate: each worker’s expenses, the worker-expense total, total investment, total income, then each site’s worker expenses, income and investment, and a gross that combines them.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block w-40 text-xs font-medium text-graphite-500">
          From
          <input type="date" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block w-40 text-xs font-medium text-graphite-500">
          To
          <input type="date" className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div>
          <p className="mb-1 text-xs font-medium text-graphite-500">File type</p>
          <div className="flex flex-wrap rounded border border-steel-200 bg-surface p-0.5" role="group" aria-label="Export file type">
            {FORMATS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFormat(item.id)}
                aria-pressed={format === item.id}
                className={`rounded px-3 py-1.5 text-xs transition-colors ${format === item.id ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn-accent" onClick={download} disabled={busy || rangeInvalid}>
          <Download size={15} aria-hidden="true" />
          {busy ? "Preparing file…" : "Download"}
        </button>
      </div>
      <p className="mt-2 text-xs text-graphite-400">
        Leave the dates blank to match the company gross summary on this page. A date range limits every section to that period.
      </p>
      {rangeInvalid && <p className="mt-1 text-sm text-rust">The start date must be on or before the end date.</p>}
      {error && !rangeInvalid && <p className="mt-1 text-sm text-rust">{error}</p>}
    </section>
  );
}
