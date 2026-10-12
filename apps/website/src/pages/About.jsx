import { Target, Eye } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { Icon } from "@/lib/icons";
import { CtaBand, PageHero, SectionTitle } from "@/components/ui";

export function About() {
  const { content } = useSiteContent();
  const { about, company } = content;
  useDocumentTitle("About");

  return (
    <>
      <PageHero
        eyebrow="About us"
        title={about.title}
        intro={about.intro}
        image={about.image}
        breadcrumb={[{ label: "Home", to: "/" }, { label: "About" }]}
      />

      <section className="section">
        <div className="container-x grid gap-14 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SectionTitle eyebrow="Our story" title={`How ${company.shortName} was built`} />
            <div className="mt-6 space-y-5 text-base leading-relaxed text-slate-600">
              {about.story.split(/\n\s*\n/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
          <div className="grid gap-6 lg:col-span-2">
            <div className="rounded-sm bg-brand-900 p-8 text-white">
              <Target size={26} className="text-accent" />
              <h3 className="mt-4 text-xl font-bold text-white">Our mission</h3>
              <p className="mt-2 text-white/80">{about.mission}</p>
            </div>
            <div className="rounded-sm border border-slate-200 bg-slate-50 p-8">
              <Eye size={26} className="text-brand-600" />
              <h3 className="mt-4 text-xl font-bold">Our vision</h3>
              <p className="mt-2 text-slate-600">{about.vision}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container-x">
          <SectionTitle eyebrow="Our values" title="What guides every decision we make" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {about.values.map((value, i) => (
              <div key={value.title} className="card p-7">
                <span className="font-display text-3xl font-extrabold text-accent">0{i + 1}</span>
                <h3 className="mt-3 text-xl font-bold">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-x">
          <SectionTitle eyebrow="Milestones" title="Our journey so far" />
          <ol className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {about.milestones.map((m) => (
              <li key={m.year + m.title} className="relative border-t-4 border-brand-900 pt-6">
                <span className="font-display text-3xl font-extrabold text-brand-600">{m.year}</span>
                <h3 className="mt-2 text-lg font-bold">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container-x">
          <SectionTitle eyebrow="Leadership" title="The people behind the projects" />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {about.leadership.map((person) => (
              <div key={person.name} className="card flex gap-6 p-7">
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sm bg-brand-900 font-display text-2xl font-extrabold text-accent">
                  {person.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <h3 className="text-xl font-bold">{person.name}</h3>
                  <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{person.role}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{person.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-x">
          <SectionTitle eyebrow="Compliance" title="Registrations, standards & controls" />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {about.certifications.map((c) => (
              <div key={c.title} className="flex gap-4 rounded-sm border border-slate-200 p-6">
                <Icon name="BadgeCheck" size={26} className="mt-0.5 shrink-0 text-brand-600" />
                <div>
                  <h3 className="font-bold">{c.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Want to work with a team that delivers?"
        body="Tell us about your project and we will come back with a practical plan."
        primary={{ label: "Start a project", href: "/contact" }}
        secondary={{ label: "See our projects", href: "/projects" }}
      />
    </>
  );
}
