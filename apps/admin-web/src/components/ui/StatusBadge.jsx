import { cx } from "@/lib/format";

const STATUS_STYLES = {
  ACTIVE: "bg-teal-50 text-teal",
  APPROVED: "bg-teal-50 text-teal",
  VERIFIED: "bg-teal-50 text-teal",
  PAID: "bg-teal-50 text-teal",
  FINALIZED: "bg-teal-50 text-teal",
  PRESENT: "bg-teal-50 text-teal",
  RESOLVED: "bg-teal-50 text-teal",

  PENDING_VERIFICATION: "bg-amber-50 text-amber-600",
  REQUESTED: "bg-amber-50 text-amber-600",
  DRAFT: "bg-amber-50 text-amber-600",
  CALCULATED: "bg-amber-50 text-amber-600",
  REVIEW: "bg-amber-50 text-amber-600",
  IN_PROGRESS: "bg-amber-50 text-amber-600",
  OPEN: "bg-amber-50 text-amber-600",
  PLANNING: "bg-amber-50 text-amber-600",
  DOCUMENT_VERIFIED: "bg-amber-50 text-amber-600",
  WORK_TYPE_VERIFIED: "bg-amber-50 text-amber-600",
  ON_HOLD: "bg-amber-50 text-amber-600",
  PARTIALLY_APPROVED: "bg-amber-50 text-amber-600",

  REJECTED: "bg-rust-50 text-rust",
  SUSPENDED: "bg-rust-50 text-rust",
  ABSENT: "bg-rust-50 text-rust",
  CANCELLED: "bg-rust-50 text-rust",
  CLOSED: "bg-steel-100 text-graphite-500",
  COMPLETED: "bg-steel-100 text-graphite-500"
};

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? "bg-steel-100 text-graphite-500";
  return <span className={cx("badge", style)}>{status.replace(/_/g, " ")}</span>;
}