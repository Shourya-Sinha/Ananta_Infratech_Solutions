import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { EmptyState, NewsCard, PageHero } from "@/components/ui";

export function News() {
  const { content } = useSiteContent();
  useDocumentTitle("News");
  const items = [...content.news].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <>
      <PageHero
        eyebrow="News & updates"
        title="Company news, safety updates and announcements."
        intro="What is happening across our sites, our team and our platform."
        breadcrumb={[{ label: "Home", to: "/" }, { label: "News" }]}
      />
      <section className="section">
        <div className="container-x">
          {items.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <NewsCard key={item.slug} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState title="No news yet">Check back soon.</EmptyState>
          )}
        </div>
      </section>
    </>
  );
}
