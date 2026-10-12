import { Check } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { CtaBand, PageHero, ServiceCard, SectionTitle } from "@/components/ui";

export function Services() {
  const { content } = useSiteContent();
  useDocumentTitle("Services");
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="End-to-end construction and infrastructure services."
        intro="From the first foundation to final finishing, we deliver residential, commercial, civil and industrial projects with one accountable team."
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Services" }]}
      />

      <section className="section">
        <div className="container-x grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {content.services.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
      </section>

      <section className="section section-muted">
        <div className="container-x grid items-start gap-12 lg:grid-cols-2">
          <SectionTitle eyebrow="Engagement models" title="Choose how you want to work with us" intro="Every engagement is scoped to your brief, timeline and budget. We can take a full turnkey contract or supply specific packages." />
          <div className="grid gap-4">
            {[
              ["Turnkey contract", "Design coordination, execution, quality control and handover under a single contract."],
              ["Item-rate / tender works", "Competitive rates for public works and road packages with measurement-based billing."],
              ["Manpower supply", "Verified, trade-wise skilled labour with attendance and payroll tracked for you."],
              ["Finishing & fit-out", "Specialist finishing teams for handover-ready interiors."]
            ].map(([title, body]) => (
              <div key={title} className="flex gap-4 rounded-sm border border-slate-200 bg-white p-5">
                <Check size={20} className="mt-0.5 shrink-0 text-brand-600" />
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Not sure which service you need?" body="Describe your site and requirement. We will recommend the right package." primary={{ label: "Talk to our team", href: "/contact" }} />
    </>
  );
}
