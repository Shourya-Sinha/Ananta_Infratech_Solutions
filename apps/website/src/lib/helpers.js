import { useEffect } from "react";

export function findBySlug(list, slug) {
  return (list || []).find((item) => item.slug === slug);
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Ananta Infratech Solutions` : "Ananta Infratech Solutions";
  }, [title]);
}

export function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Digits only, for tel: and wa.me links. */
export function telDigits(phone) {
  return String(phone || "").replace(/[^0-9+]/g, "");
}
