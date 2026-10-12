import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { findBySlug, useDocumentTitle } from "@/lib/helpers";
import { Icon } from "@/lib/icons";
import { CtaBand, PageHero, ServiceCard, SectionTitle } from "@/components/ui";
import { NotFound } from "@/pages/NotFound";

export function ServiceDetail() {
  const { slug } = useParams();
  const { content } = useSiteContent();
  const service = findBySlug(content.services, slug);
  useDocumentTitle(service?.title);
  if (!service) return <NotFound />;

  const others = content.services.filter((s) => s.slug !== slug).slice(0, 3);

  return (
    <>
      <PageHero
        eyebrow="Service"
        title={service.title}
        intro={service.summary}
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Services", to: "/services" }, { label: service.title }]}>
        <Link to={`/contact?service=${encodeURIComponent(service.title)}`} className="btn-accent">
          Request a quote <ArrowRight size={16} />
        </Link>
      </PageHero>

      <section className="section">
        <div className="container-x grid gap-14 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionTitle eyebrow="Overview" title={`What our ${service.title.toLowerCase()} service includes`} />
            <p className="mt-6 text-base leading-relaxed text-slate-600">{service.description}</p>
          </div>
          <aside className="rounded-sm bg-slate-50 p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-brand-900 text-accent">
              <Icon name={service.icon} size={28} />
            </span>
            <h2 className="mt-5 text-xl font-bold">Key highlights</h2>
            <ul className="mt-4 space-y-3">
              {service.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-sm text-slate-700">
                  <Check size={18} className="mt-0.5 shrink-0 text-brand-600" /> {h}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {others.length > 0 && (
        <section className="section section-muted">
          <div className="container-x">
            <SectionTitle eyebrow="Other services" title="Explore more of what we do" />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {others.map((s) => (
                <ServiceCard key={s.slug} service={s} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand title={`Planning a ${service.title.toLowerCase()} project?`} body="Share your location, drawings and timeline. We will prepare a site-specific proposal." primary={{ label: "Request a quote", href: `/contact?service=${encodeURIComponent(service.title)}` }} secondary={{ label: "All services", href: "/services" }} />
    </>
  );
}
