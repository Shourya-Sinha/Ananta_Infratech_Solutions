import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SmartLink } from "@/components/SmartLink";
import { Icon } from "@/lib/icons";
import { formatDate } from "@/lib/helpers";

export function SectionTitle({ eyebrow, title, intro, align = "left", light = false }) {
  const alignment = align === "center" ? "mx-auto text-center" : "";
  return (
    <div className={`max-w-3xl ${alignment}`}>
      {eyebrow && <p className={`eyebrow ${light ? "!text-accent" : ""} ${align === "center" ? "justify-center" : ""}`}>{eyebrow}</p>}
      <h2 className={`text-3xl font-extrabold leading-tight sm:text-4xl ${light ? "text-white" : ""}`}>{title}</h2>
      {intro && <p className={`mt-4 text-base leading-relaxed ${light ? "text-white/75" : "text-slate-600"}`}>{intro}</p>}
    </div>
  );
}

export function PageHero({ eyebrow, title, intro, image, children, breadcrumb }) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-900 text-white">
      {image && (
        <>
          <img src={image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-900 via-brand-900/85 to-brand-900/40" />
        </>
      )}
      <div className="container-x py-16 sm:py-24">
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-white/60">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-2">
                {crumb.to ? <Link to={crumb.to} className="hover:text-accent">{crumb.label}</Link> : <span className="text-white/90">{crumb.label}</span>}
                {i < breadcrumb.length - 1 && <span aria-hidden="true">/</span>}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="eyebrow !text-accent">{eyebrow}</p>}
        <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] text-white sm:text-6xl">{title}</h1>
        {intro && <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">{intro}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
      <div className="h-1.5 w-full bg-accent" aria-hidden="true" />
    </section>
  );
}

export function CtaBand({ title, body, primary, secondary }) {
  return (
    <section className="section">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-sm bg-brand-900 px-8 py-12 text-white sm:px-14 sm:py-16">
          <div className="absolute right-0 top-0 h-full w-1/3 bg-accent/10 [clip-path:polygon(30%_0,100%_0,100%_100%,0_100%)]" aria-hidden="true" />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">{title}</h2>
              {body && <p className="mt-3 text-white/80">{body}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              {primary && (
                <SmartLink href={primary.href} className="btn-accent">
                  {primary.label} <ArrowRight size={16} />
                </SmartLink>
              )}
              {secondary && (
                <SmartLink href={secondary.href} className="btn-outline-light">
                  {secondary.label}
                </SmartLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ServiceCard({ service }) {
  return (
    <Link to={`/services/${service.slug}`} className="card group flex flex-col p-7">
      <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-brand-50 text-brand-900 transition group-hover:bg-accent">
        <Icon name={service.icon} size={24} />
      </span>
      <h3 className="mt-5 text-xl font-bold">{service.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{service.summary}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 group-hover:text-brand-900">
        View details <ArrowRight size={15} />
      </span>
    </Link>
  );
}

const STATUS_STYLES = {
  Completed: "bg-emerald-50 text-emerald-700",
  Ongoing: "bg-accent-50 text-brand-900",
  Upcoming: "bg-brand-50 text-brand-700"
};

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_STYLES[status] || "bg-slate-100 text-slate-700"}`}>{status}</span>;
}

export function ProjectCard({ project }) {
  return (
    <Link to={`/projects/${project.slug}`} className="card group flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
        {project.image && <img src={project.image} alt={project.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
        <div className="absolute left-4 top-4">
          <StatusBadge status={project.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{project.category}</p>
        <h3 className="mt-1.5 text-xl font-bold">{project.title}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {project.location} · {project.year}
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 group-hover:text-brand-900">
          Project details <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
}

export function NewsCard({ item }) {
  return (
    <Link to={`/news/${item.slug}`} className="card group flex flex-col p-7">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-brand-600">
        <span>{item.category}</span>
        <span className="text-slate-300">•</span>
        <time dateTime={item.date}>{formatDate(item.date)}</time>
      </div>
      <h3 className="mt-3 text-xl font-bold leading-snug">{item.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{item.excerpt}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 group-hover:text-brand-900">
        Read more <ArrowRight size={15} />
      </span>
    </Link>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children && <div className="mt-3 text-slate-600">{children}</div>}
    </div>
  );
}
