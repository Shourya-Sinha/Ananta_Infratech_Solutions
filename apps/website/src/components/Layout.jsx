import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronRight, Mail, Menu, MapPin, Phone, X, Clock, MessageCircle } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { SmartLink } from "@/components/SmartLink";
import { telDigits } from "@/lib/helpers";

const NAV = [
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/projects", label: "Projects" },
  { to: "/safety", label: "Safety" },
  { to: "/clients", label: "Clients" },
  { to: "/careers", label: "Careers" },
  { to: "/news", label: "News" },
  { to: "/contact", label: "Contact" }
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function Logo({ name }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-brand-900">
        <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
          <path d="M32 12 L52 50 H42 L32 30 L22 50 H12 Z" fill="#F2B705" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-extrabold uppercase tracking-tight text-brand-900">{name}</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Infrastructure · Construction</span>
      </span>
    </span>
  );
}

function Header({ company, announcement }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="hidden bg-brand-900 text-xs text-white/85 md:block">
        <div className="container-x flex h-9 items-center justify-between">
          <div className="flex items-center gap-6">
            <a href={`tel:${telDigits(company.phone)}`} className="flex items-center gap-1.5 hover:text-accent">
              <Phone size={13} /> {company.phone}
            </a>
            <a href={`mailto:${company.email}`} className="flex items-center gap-1.5 hover:text-accent">
              <Mail size={13} /> {company.email}
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} /> {company.hours}
          </div>
        </div>
      </div>

      <div className="container-x flex h-20 items-center justify-between">
        <Link to="/" aria-label={`${company.name} home`}>
          <Logo name={company.shortName} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
            Home
          </NavLink>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/contact" className="btn-accent hidden sm:inline-flex">
            Get a quote
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-slate-300 text-brand-900 xl:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-slate-200 bg-white xl:hidden">
          <div className="container-x grid gap-1 py-4">
            {[{ to: "/", label: "Home" }, ...NAV].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-sm px-3 py-3 text-base font-semibold ${
                    isActive ? "bg-brand-50 text-brand-900" : "text-slate-700 hover:bg-slate-50"
                  }`
                }>
                {item.label}
                <ChevronRight size={16} className="text-slate-400" />
              </NavLink>
            ))}
            <Link to="/contact" className="btn-accent mt-3">
              Get a quote
            </Link>
          </div>
        </nav>
      )}

      {announcement?.enabled && announcement.text && (
        <div className="bg-accent-50 text-center text-sm text-brand-900">
          <div className="container-x flex flex-wrap items-center justify-center gap-2 py-2">
            <span>{announcement.text}</span>
            {announcement.link && announcement.linkLabel && (
              <SmartLink href={announcement.link} className="font-semibold underline underline-offset-4 hover:text-brand-600">
                {announcement.linkLabel}
              </SmartLink>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function navClass(isActive) {
  return `rounded-sm px-3 py-2 text-sm font-semibold transition ${
    isActive ? "text-brand-900 underline decoration-accent decoration-2 underline-offset-8" : "text-slate-600 hover:text-brand-900"
  }`;
}

function Footer({ content }) {
  const { company, services } = content;
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-900 text-white/80">
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <Logo name={company.shortName} />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">{company.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            {Object.entries(company.social || {})
              .filter(([, href]) => href)
              .map(([name, href]) => (
                <SmartLink key={name} href={href} className="rounded-sm border border-white/20 px-3 py-1.5 capitalize hover:border-accent hover:text-accent">
                  {name}
                </SmartLink>
              ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-white">Company</h3>
          <ul className="space-y-2.5 text-sm">
            {NAV.filter((item) => item.to !== "/projects" && item.to !== "/services").map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-accent">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-white">Services</h3>
          <ul className="space-y-2.5 text-sm">
            {services.slice(0, 6).map((service) => (
              <li key={service.slug}>
                <Link to={`/services/${service.slug}`} className="hover:text-accent">
                  {service.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-white">Contact</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-accent" /> {company.address}
            </li>
            <li className="flex gap-2.5">
              <Phone size={16} className="mt-0.5 shrink-0 text-accent" />
              <a href={`tel:${telDigits(company.phone)}`} className="hover:text-accent">
                {company.phone}
              </a>
            </li>
            <li className="flex gap-2.5">
              <Mail size={16} className="mt-0.5 shrink-0 text-accent" />
              <a href={`mailto:${company.email}`} className="hover:text-accent">
                {company.email}
              </a>
            </li>
            <li className="flex gap-2.5">
              <Clock size={16} className="mt-0.5 shrink-0 text-accent" /> {company.hours}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {company.name}. All rights reserved.
          </p>
          <p>{company.registration}</p>
        </div>
      </div>
    </footer>
  );
}

function FloatingActions({ company }) {
  const digits = telDigits(company.whatsapp);
  if (!digits) return null;
  return (
    <a
      href={`https://wa.me/${digits.replace(/^\+/, "")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lift transition hover:brightness-110"
      aria-label="Chat with us on WhatsApp">
      <MessageCircle size={18} /> <span className="hidden sm:inline">WhatsApp us</span>
    </a>
  );
}

export function Layout() {
  const { content, preview } = useSiteContent();
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      {preview && (
        <div className="bg-accent px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-brand-900">
          Draft preview — these changes are not published yet
        </div>
      )}
      <Header company={content.company} announcement={content.announcement} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer content={content} />
      <FloatingActions company={content.company} />
    </div>
  );
}
