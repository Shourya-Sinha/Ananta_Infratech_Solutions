export function formatINR(amountRupees) {
  // Every paise matters: always show exactly 2 decimals (₹93.75,
  // ₹562.50) — never round a display amount to the nearest rupee.
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountRupees);
}

export function formatDate(value) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(value) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}