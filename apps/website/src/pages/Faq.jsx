import { ChevronDown } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { CtaBand, PageHero } from "@/components/ui";

export function Faq() {
  const { content } = useSiteContent();
  useDocumentTitle("FAQ");
  return (
    <>
      <PageHero
        eyebrow="Frequently asked questions"
        title="Answers to common questions."
        intro="Can't find what you need? Send us a message and we will reply within one working day."
        breadcrumb={[{ label: "Home", to: "/" }, { label: "FAQ" }]}
      />
      <section className="section">
        <div className="container-x max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
          {content.faq.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-brand-900">
                {item.question}
                <ChevronDown size={20} className="shrink-0 text-brand-600 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 leading-relaxed text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <CtaBand title="Still have a question?" primary={{ label: "Contact us", href: "/contact" }} />
    </>
  );
}
