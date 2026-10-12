import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { submitInquiry } from "@/lib/api";
import { telDigits, useDocumentTitle } from "@/lib/helpers";
import { PageHero } from "@/components/ui";

function ContactForm({ services, initialService, initialMessage, preview }) {
  const [values, setValues] = useState({ name: "", phone: "", email: "", service: initialService || "", message: initialMessage || "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const update = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (preview) return;
    setStatus("submitting");
    setError("");
    try {
      await submitInquiry({ kind: "CONTACT", ...values });
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
        <CheckCircle2 size={24} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-lg font-semibold">Thank you — your message has been received.</p>
          <p className="mt-1 text-sm">Our team will get back to you within one working day.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <div>
        <label className="label" htmlFor="c-name">Full name <span className="text-rust">*</span></label>
        <input id="c-name" className="input" required value={values.name} onChange={update("name")} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="c-phone">Phone <span className="text-rust">*</span></label>
        <input id="c-phone" className="input" type="tel" required value={values.phone} onChange={update("phone")} autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="c-email">Email</label>
        <input id="c-email" className="input" type="email" value={values.email} onChange={update("email")} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="c-service">Service of interest</label>
        <select id="c-service" className="input" value={values.service} onChange={update("service")}>
          <option value="">Select a service</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="c-message">Project details <span className="text-rust">*</span></label>
        <textarea id="c-message" rows={6} className="input" required value={values.message} onChange={update("message")} placeholder="Location, type of work, approximate area, timeline and any drawings you have." />
      </div>
      {error && (
        <p className="sm:col-span-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn-brand" disabled={status === "submitting" || preview}>
          {status === "submitting" && <Loader2 size={16} className="animate-spin" />}
          {preview ? "Form disabled in preview" : "Send message"}
        </button>
        <p className="text-xs text-slate-500">By submitting you agree to be contacted about your enquiry.</p>
      </div>
    </form>
  );
}

export function Contact() {
  const { content, preview } = useSiteContent();
  const [params] = useSearchParams();
  const { company, contact } = content;
  useDocumentTitle("Contact");

  const role = params.get("role");
  const service = params.get("service");
  const initialService = contact.services.includes(service) ? service : "";
  const initialMessage = role ? `I am interested in the role: ${role}.\n\n` : "";

  const cards = [
    { icon: Phone, label: "Call us", value: company.phone, href: `tel:${telDigits(company.phone)}` },
    { icon: Mail, label: "Email us", value: company.email, href: `mailto:${company.email}` },
    { icon: MapPin, label: "Office", value: company.address },
    { icon: Clock, label: "Working hours", value: company.hours }
  ];

  return (
    <>
      <PageHero eyebrow="Contact" title={contact.title} intro={contact.intro} breadcrumb={[{ label: "Home", to: "/" }, { label: "Contact" }]} />
      <section className="section">
        <div className="container-x grid gap-12 lg:grid-cols-5">
          <div className="rounded-sm border border-slate-200 p-7 shadow-sm sm:p-10 lg:col-span-3">
            <h2 className="text-2xl font-extrabold">Send us a message</h2>
            <p className="mt-2 mb-8 text-sm text-slate-600">Fields marked * are required.</p>
            <ContactForm
              key={`${initialService}|${initialMessage}`}
              services={contact.services}
              initialService={initialService}
              initialMessage={initialMessage}
              preview={preview}
            />
          </div>
          <div className="space-y-4 lg:col-span-2">
            {cards.map((c) => (
              <div key={c.label} className="flex gap-4 rounded-sm bg-slate-50 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-brand-900 text-accent">
                  <c.icon size={20} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
                  {c.href ? (
                    <a href={c.href} className="font-semibold text-brand-900 hover:text-brand-600">
                      {c.value}
                    </a>
                  ) : (
                    <p className="font-semibold text-brand-900">{c.value}</p>
                  )}
                </div>
              </div>
            ))}
            {company.mapEmbedUrl && (
              <iframe title="Office location map" src={company.mapEmbedUrl} className="h-64 w-full rounded-sm border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
