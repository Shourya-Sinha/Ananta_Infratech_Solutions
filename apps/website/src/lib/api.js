/**
 * Submits a public website form (contact, or careers "notify me" interest).
 * Throws an Error whose message is safe to show to the visitor.
 */
export async function submitInquiry(payload) {
  const res = await fetch("/api/v1/public/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const fieldErrors = json?.error?.details?.fieldErrors;
    const firstFieldError = fieldErrors && Object.values(fieldErrors).flat().find(Boolean);
    throw new Error(firstFieldError || json?.error?.message || "Something went wrong. Please try again.");
  }
  return json.data;
}
