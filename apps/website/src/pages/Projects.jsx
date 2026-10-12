import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { CtaBand, EmptyState, PageHero, ProjectCard } from "@/components/ui";

export function Projects() {
  const { content } = useSiteContent();
  const [params, setParams] = useSearchParams();
  useDocumentTitle("Projects");

  const categories = useMemo(() => ["All", ...new Set(content.projects.map((p) => p.category))], [content.projects]);
  const active = categories.includes(params.get("category")) ? params.get("category") : "All";
  const visible = content.projects.filter((p) => active === "All" || p.category === active);

  return (
    <>
      <PageHero
        eyebrow="Our projects"
        title="Projects delivered and in progress."
        intro="A selection of residential, commercial, infrastructure and institutional work across Bihar."
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Projects" }]}
      />

      <section className="section">
        <div className="container-x">
          <div role="tablist" aria-label="Filter projects by category" className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={active === cat}
                onClick={() => setParams(cat === "All" ? {} : { category: cat })}
                className={`rounded-sm border px-4 py-2 text-sm font-semibold transition ${
                  active === cat ? "border-brand-900 bg-brand-900 text-white" : "border-slate-300 text-slate-700 hover:border-brand-900"
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {visible.length > 0 ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </div>
          ) : (
            <div className="mt-10">
              <EmptyState title="No projects in this category yet" />
            </div>
          )}
        </div>
      </section>

      <CtaBand title="Have a project in mind?" body="We take on residential, commercial, civil and industrial work." primary={{ label: "Start your project", href: "/contact" }} />
    </>
  );
}
