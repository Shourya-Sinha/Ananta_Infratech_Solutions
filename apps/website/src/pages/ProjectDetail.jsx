import { useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { findBySlug, useDocumentTitle } from "@/lib/helpers";
import { CtaBand, PageHero, ProjectCard, SectionTitle, StatusBadge } from "@/components/ui";
import { NotFound } from "@/pages/NotFound";

export function ProjectDetail() {
  const { slug } = useParams();
  const { content } = useSiteContent();
  const project = findBySlug(content.projects, slug);
  useDocumentTitle(project?.title);
  if (!project) return <NotFound />;

  const related = content.projects.filter((p) => p.slug !== slug && p.category === project.category).slice(0, 3);
  const facts = [
    ["Client", project.client],
    ["Location", project.location],
    ["Year", project.year],
    ["Built-up area", project.area],
    ["Project value", project.value]
  ].filter(([, v]) => v);

  return (
    <>
      <PageHero
        eyebrow={project.category}
        title={project.title}
        intro={project.location}
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Projects", to: "/projects" }, { label: project.title }]}>
        <StatusBadge status={project.status} />
      </PageHero>

      <section className="section">
        <div className="container-x grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {project.image && <img src={project.image} alt={project.title} className="aspect-video w-full rounded-sm object-cover shadow-lift" />}
            <SectionTitle eyebrow="Project overview" title="Scope and delivery" />
            <p className="mt-5 text-base leading-relaxed text-slate-600">{project.description}</p>
            {project.highlights?.length > 0 && (
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {project.highlights.map((h) => (
                  <li key={h} className="flex gap-3 rounded-sm bg-slate-50 p-4 text-sm font-medium text-slate-700">
                    <Check size={18} className="mt-0.5 shrink-0 text-brand-600" /> {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="h-fit rounded-sm bg-brand-900 p-8 text-white">
            <h2 className="text-xl font-bold text-white">Project facts</h2>
            <dl className="mt-6 divide-y divide-white/10">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-3 text-sm">
                  <dt className="text-white/60">{label}</dt>
                  <dd className="text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section section-muted">
          <div className="container-x">
            <SectionTitle eyebrow="Related" title={`More ${project.category.toLowerCase()} projects`} />
            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {related.map((p) => (
                <ProjectCard key={p.slug} project={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand title="Want a similar project delivered?" body="Share your site details and we will come back with a plan and estimate." primary={{ label: "Request a quote", href: "/contact" }} />
    </>
  );
}
