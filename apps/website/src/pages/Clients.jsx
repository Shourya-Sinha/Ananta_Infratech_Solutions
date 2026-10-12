import { Quote } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { CtaBand, PageHero, SectionTitle } from "@/components/ui";

export function Clients() {
  const { content } = useSiteContent();
  const { clients, testimonials } = content;
  useDocumentTitle("Clients");

  return (
    <>
      <PageHero
        eyebrow="Clients & partners"
        title="We build for those who depend on us."
        intro="Private developers, logistics partners, public authorities and industrial clients trust us with their most important projects."
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Clients" }]}
      />

      <section className="section">
        <div className="container-x">
          <SectionTitle eyebrow="Who we work with" title="Sectors we serve" />
          <div className="mt-12 grid gap-px overflow-hidden rounded-sm bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <div key={client.name} className="bg-white p-8">
                <h3 className="text-lg font-bold">{client.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{client.sector}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container-x">
          <SectionTitle eyebrow="Testimonials" title="In our clients' words" />
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {testimonials.map((t, i) => (
              <figure key={i} className="card flex flex-col p-8">
                <Quote size={26} className="text-accent" />
                <blockquote className="mt-4 flex-1 text-slate-700">“{t.quote}”</blockquote>
                <figcaption className="mt-6 border-t border-slate-200 pt-4">
                  <p className="font-bold text-brand-900">{t.name}</p>
                  <p className="text-sm text-slate-500">{t.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Join our growing list of clients" primary={{ label: "Start a conversation", href: "/contact" }} secondary={{ label: "View projects", href: "/projects" }} />
    </>
  );
}
