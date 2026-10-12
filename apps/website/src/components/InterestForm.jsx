import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitInquiry } from "@/lib/api";
import { useSiteContent } from "@/lib/SiteContentContext";

const FIELDS = {
  CAREER_CONTRACTOR: [
    { name: "name", label: "Full name", required: true },
    { name: "company", label: "Company / crew name" },
    { name: "phone", label: "Mobile number", required: true, type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "city", label: "City / district", required: true },
    { name: "trade", label: "Main trades you manage" }
  ],
  CAREER_WORKER: [
    { name: "name", label: "Full name", required: true },
    { name: "phone", label: "Mobile number", required: true, type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "city", label: "City / district", required: true },
    { name: "trade", label: "Your trade (mason, carpenter, electrician…)", required: true },
    { name: "experienceYears", label: "Years of experience", type: "number" }
  ]
};

/**
 * "Notify me when registration opens" form for the careers page. Captured
 * as waitlist entries (kind CAREER_CONTRACTOR / CAREER_WORKER) in the CMS
 * enquiries inbox until the registration app is live.
 */
export function InterestForm({ kind, buttonLabel = "Notify me when it opens" }) {
  const { preview } = useSiteContent();
  const fields = FIELDS[kind];
  const [values, setValues] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function update(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (preview) return;
    setStatus("submitting");
    setError("");
    const payload = { kind };
    for (const field of fields) {
      const raw = values[field.name];
      if (raw === undefined || raw === "") continue;
      payload[field.name] = field.type === "number" ? Number(raw) : raw;
    }
    try {
      await submitInquiry(payload);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
        <CheckCircle2 size={22} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Thank you — you are on the list.</p>
          <p className="mt-1 text-sm">We will contact you on the number you shared as soon as registration opens.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      {fields.map((field) => (
        <div key={field.name} className={field.name === "trade" || field.name === "name" ? "sm:col-span-2" : ""}>
          <label className="label" htmlFor={`${kind}-${field.name}`}>
            {field.label}
            {field.required && <span className="text-rust"> *</span>}
          </label>
          <input
            id={`${kind}-${field.name}`}
            className="input"
            type={field.type || "text"}
            required={field.required}
            value={values[field.name] ?? ""}
            onChange={(e) => update(field.name, e.target.value)}
          />
        </div>
      ))}
      {error && <p className="sm:col-span-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-brand" disabled={status === "submitting" || preview}>
          {status === "submitting" && <Loader2 size={16} className="animate-spin" />}
          {preview ? "Form disabled in preview" : buttonLabel}
        </button>
        <p className="text-xs text-slate-500">We only use your details to contact you about registration.</p>
      </div>
    </form>
  );
}
