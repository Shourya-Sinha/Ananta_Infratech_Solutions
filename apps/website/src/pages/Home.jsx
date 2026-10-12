import { ArrowRight, Quote } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { Icon } from "@/lib/icons";
import { SmartLink } from "@/components/SmartLink";
import { CtaBand, NewsCard, ProjectCard, SectionTitle, ServiceCard } from "@/components/ui";

export function Home() {
  const { content } = useSiteContent();
  const { home, services, projects, testimonials, clients, news, safety, company } = content;
  useDocumentTitle("");

  const featured = projects.filter((p) => p.featured).slice(0, 3);
  const latestNews = news.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <img src={home.heroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-900 via-brand-900/80 to-brand-900/30" />
        <div className="container-x flex min-h-[78vh] flex-col justify-center py-20 sm:py-28">
          <p className="eyebrow !text-accent">{home.heroEyebrow}</p>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.02] text-white sm:text-6xl lg:text-7xl">{home.heroTitle}</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">{home.heroSubtitle}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <SmartLink href={home.primaryCta.href} className="btn-accent">
              {home.primaryCta.label} <ArrowRight size={16} />
            </SmartLink>
            <SmartLink href={home.secondaryCta.href} className="btn-outline-light">
              {home.secondaryCta.label}
            </SmartLink>
          </div>
        </div>
        <div className="relative border-t border-white/10 bg-brand-900/90 backdrop-blur">
          <dl className="container-x grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
            {home.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="order-2 text-sm text-white/70">{stat.label}</dt>
                <dd className="order-1 font-display text-4xl font-extrabold text-accent">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Intro */}
      <section className="section">
        <div className="container-x grid items-start gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow">{home.intro.eyebrow}</p>
            <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">{home.intro.title}</h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600">{home.intro.body}</p>
            <SmartLink href="/about" className="mt-7 inline-flex items-center gap-2 font-semibold text-brand-600 hover:text-brand-900">
              About {company.shortName} <ArrowRight size={16} />
            </SmartLink>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {home.whyUs.slice(0, 4).map((item) => (
              <div key={item.title} className="rounded-sm border-l-4 border-accent bg-slate-50 p-5">
                <Icon name={item.icon} size={22} className="text-brand-900" />
                <h3 className="mt-3 text-base font-bold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section section-muted">
        <div className="container-x">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionTitle eyebrow="What we do" title="Construction capabilities across every sector" />
            <SmartLink href="/services" className="inline-flex items-center gap-2 font-semibold text-brand-600 hover:text-brand-900">
              All services <ArrowRight size={16} />
            </SmartLink>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {services.slice(0, 6).map((service) => (
              <ServiceCard key={service.slug} service={service} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured projects */}
      <section className="section">
        <div className="container-x">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionTitle eyebrow="Our work" title="Featured projects" />
            <SmartLink href="/projects" className="inline-flex items-center gap-2 font-semibold text-brand-600 hover:text-brand-900">
              View all projects <ArrowRight size={16} />
            </SmartLink>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(featured.length ? featured : projects.slice(0, 3)).map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="section bg-brand-900 text-white">
        <div className="container-x">
          <SectionTitle light eyebrow="How we work" title="A clear process from first call to handover" />
          <ol className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {home.process.map((step, i) => (
              <li key={step.title} className="rounded-sm border border-white/10 bg-white/5 p-7">
                <span className="font-display text-5xl font-extrabold text-accent">0{i + 1}</span>
                <h3 className="mt-4 text-xl font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why us */}
      <section className="section">
        <div className="container-x">
          <SectionTitle eyebrow="Why Ananta" title="Built on discipline, safety and trust" intro="Clients choose us for predictable delivery and clean records. Here is what that looks like on site." />
          <div className="mt-14 grid gap-px overflow-hidden rounded-sm bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {home.whyUs.map((item) => (
              <div key={item.title} className="bg-white p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-accent text-brand-900">
                  <Icon name={item.icon} size={24} />
                </span>
                <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety teaser */}
      <section className="section section-muted">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <img src={safety.image} alt="Site safety inspection" loading="lazy" className="aspect-[4/3] w-full rounded-sm object-cover shadow-lift" />
          <div>
            <p className="eyebrow">Health & safety</p>
            <h2 className="text-3xl font-extrabold sm:text-4xl">{safety.title}</h2>
            <p className="mt-4 text-slate-600">{safety.intro}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {safety.points.slice(0, 4).map((point) => (
                <li key={point.title} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 bg-accent" aria-hidden="true" />
                  <span>
                    <strong className="block text-brand-900">{point.title}</strong>
                    <span className="text-slate-600">{point.body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <SmartLink href="/safety" className="btn-brand mt-8">
              Our safety commitment <ArrowRight size={16} />
            </SmartLink>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section">
        <div className="container-x">
          <SectionTitle eyebrow="Testimonials" title="What our clients say" />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.slice(0, 3).map((t, i) => (
              <figure key={i} className="card flex flex-col p-8">
                <Quote size={28} className="text-accent" />
                <blockquote className="mt-4 flex-1 text-base leading-relaxed text-slate-700">“{t.quote}”</blockquote>
                <figcaption className="mt-6 border-t border-slate-200 pt-4">
                  <p className="font-bold text-brand-900">{t.name}</p>
                  <p className="text-sm text-slate-500">{t.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Clients */}
      <section className="border-y border-slate-200 bg-slate-50 py-12">
        <div className="container-x">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Trusted by developers, authorities and businesses</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {clients.map((client) => (
              <li key={client.name} className="rounded-sm border border-slate-200 bg-white px-5 py-3 text-center">
                <p className="font-display text-base font-bold text-brand-900">{client.name}</p>
                <p className="text-xs text-slate-500">{client.sector}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* News */}
      {latestNews.length > 0 && (
        <section className="section">
          <div className="container-x">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionTitle eyebrow="Latest updates" title="News & announcements" />
              <SmartLink href="/news" className="inline-flex items-center gap-2 font-semibold text-brand-600 hover:text-brand-900">
                All news <ArrowRight size={16} />
              </SmartLink>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {latestNews.map((item) => (
                <NewsCard key={item.slug} item={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand
        title={home.ctaTitle}
        body={home.ctaBody}
        primary={{ label: "Request a proposal", href: "/contact" }}
        secondary={{ label: "Call us", href: `tel:${company.phone.replace(/\s/g, "")}` }}
      />
    </>
  );
}
