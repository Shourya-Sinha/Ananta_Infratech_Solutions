import { ShieldCheck } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { Icon } from "@/lib/icons";
import { CtaBand, PageHero, SectionTitle } from "@/components/ui";

export function Safety() {
  const { content } = useSiteContent();
  const { safety } = content;
  useDocumentTitle("Health & Safety");

  return (
    <>
      <PageHero
        eyebrow="Health, safety & environment"
        title={safety.title}
        intro={safety.intro}
        image={safety.image}
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Safety" }]}
      />

      <section className="section">
        <div className="container-x">
          <SectionTitle eyebrow="How we keep people safe" title="Controls that run on every site, every shift" />
          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {safety.points.map((point) => (
              <div key={point.title} className="card p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-accent text-brand-900">
                  <ShieldCheck size={24} />
                </span>
                <h3 className="mt-5 text-lg font-bold">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container-x grid gap-10 md:grid-cols-3">
          {[
            ["Site induction", "Every worker and visitor completes a safety induction before entering a site."],
            ["Inspections", "Scheduled audits by our HSE officers with corrective actions tracked to closure."],
            ["Emergency readiness", "First-aid trained personnel, marked muster points and clear emergency contacts on site."]
          ].map(([title, body]) => (
            <div key={title} className="flex gap-4">
              <Icon name="HardHat" size={28} className="mt-1 shrink-0 text-brand-600" />
              <div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBand title="See something unsafe on a site?" body="Report it to us directly. Every concern is reviewed by our HSE team." primary={{ label: "Report a concern", href: "/contact" }} />
    </>
  );
}
