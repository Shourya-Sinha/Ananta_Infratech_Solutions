import { Building2 } from "lucide-react";

/**
 * Company credit line — shown at the bottom of the Dashboard:
 * "Developed & maintained by Shourya · Ananta Infratech Solutions".
 */
export function BrandFooter() {
  return (
    <footer className="flex flex-col items-center gap-1.5 pb-2 pt-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-graphite-900 text-amber shadow">
        <Building2 size={16} />
      </span>
      <p className="text-xs text-graphite-500">
        Developed &amp; maintained by <span className="font-display font-semibold text-graphite-900">Shourya</span>
      </p>
      <p className="font-display text-[11px] font-semibold uppercase tracking-widest text-graphite-300">
        Ananta Infratech Solutions · © {new Date().getFullYear()}
      </p>
    </footer>
  );
}
