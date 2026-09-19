
import { ChevronRight } from "lucide-react";
import { cx } from "@/lib/format";

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  onClick

}) {
  const content =
  <>
      <div className="flex items-start justify-between">
        <p className="font-display text-xs uppercase tracking-wide text-graphite-500">{label}</p>
        {onClick && <ChevronRight size={14} className="mt-0.5 text-graphite-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-amber" />}
      </div>
      <p
      className={cx(
        "mt-1.5 font-mono text-2xl font-semibold tabular-nums",
        tone === "positive" && "text-teal",
        tone === "negative" && "text-rust",
        tone === "neutral" && "text-graphite-900"
      )}>
      
        {value}
      </p>
      {sublabel && <p className="mt-1 text-xs text-graphite-500">{sublabel}</p>}
    </>;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="card group w-full p-4 text-left transition-colors duration-150 hover:border-amber hover:bg-amber-50/30 focus-visible:border-amber">
        
        {content}
      </button>);

  }

  return <div className="card p-4">{content}</div>;
}

export function EmptyState({ title, body }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1 py-14 text-center">
      <p className="font-display text-sm font-semibold text-graphite-900">{title}</p>
      <p className="max-w-sm text-sm text-graphite-500">{body}</p>
    </div>);

}

export function LoadingSkeleton({ rows = 5 }) {
  return (
    <div className="card divide-y divide-steel-200">
      {Array.from({ length: rows }).map((_, i) =>
      <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="h-4 w-1/4 animate-pulse rounded bg-steel-100" />
          <div className="h-4 w-1/6 animate-pulse rounded bg-steel-100" />
          <div className="h-4 w-1/6 animate-pulse rounded bg-steel-100" />
        </div>
      )}
    </div>);

}

export function DataTable({
  columns,
  rows,
  emptyTitle = "Nothing here yet",
  emptyBody = "Records will appear here once they exist.",
  isLoading,
  onRowClick

}) {
  if (isLoading) return <LoadingSkeleton />;
  if (!rows || rows.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-steel-200 bg-steel-100/50">
            {columns.map((col) =>
            <th
              key={col.header}
              className="whitespace-nowrap px-4 py-2.5 text-left font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
              
                {col.header}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-steel-200">
          {rows.map((row, i) =>
          <tr
            key={row._id ?? row.id ?? i}
            className={cx("transition-colors duration-150", onRowClick && "cursor-pointer hover:bg-steel-100/40")}
            onClick={() => onRowClick?.(row)}>
            
              {columns.map((col) =>
            <td key={col.header} className={cx("whitespace-nowrap px-4 py-3 text-graphite-900", col.className)}>
                  {col.cell(row)}
                </td>
            )}
            </tr>
          )}
        </tbody>
      </table>
    </div>);

}