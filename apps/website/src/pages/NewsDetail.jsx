import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { findBySlug, formatDate, useDocumentTitle } from "@/lib/helpers";
import { CtaBand, PageHero } from "@/components/ui";
import { NotFound } from "@/pages/NotFound";

export function NewsDetail() {
  const { slug } = useParams();
  const { content } = useSiteContent();
  const item = findBySlug(content.news, slug);
  useDocumentTitle(item?.title);
  if (!item) return <NotFound />;

  return (
    <>
      <PageHero
        eyebrow={`${item.category} · ${formatDate(item.date)}`}
        title={item.title}
        intro={item.excerpt}
        breadcrumb={[{ label: "Home", to: "/" }, { label: "News", to: "/news" }, { label: item.title }]}
      />
      <section className="section">
        <article className="container-x max-w-3xl">
          {item.body.split(/\n\s*\n/).map((para, i) => (
            <p key={i} className="mb-5 text-lg leading-relaxed text-slate-700">
              {para}
            </p>
          ))}
          <Link to="/news" className="mt-8 inline-flex items-center gap-2 font-semibold text-brand-600 hover:text-brand-900">
            <ArrowLeft size={16} /> Back to all news
          </Link>
        </article>
      </section>
      <CtaBand title="Have a question about our work?" primary={{ label: "Contact us", href: "/contact" }} />
    </>
  );
}
