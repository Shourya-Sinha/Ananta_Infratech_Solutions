import { useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Clock, HardHat, Users } from "lucide-react";
import { useSiteContent } from "@/lib/SiteContentContext";
import { useDocumentTitle } from "@/lib/helpers";
import { InterestForm } from "@/components/InterestForm";
import { PageHero, SectionTitle } from "@/components/ui";

function RegistrationCard({ kind, data, icon: Icon }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="flex flex-col rounded-sm border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-brand-900 text-accent">
          <Icon size={28} />
        </span>
        <span className="badge bg-accent text-brand-900">Launching soon</span>
      </div>
      <h2 className="mt-6 text-2xl font-extrabold">{data.title}</h2>
      <p className="mt-3 text-slate-600">{data.body}</p>
      <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
        {data.benefits.map((b) => (
          <li key={b} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" aria-hidden="true" /> {b}
          </li>
        ))}
      </ul>
      <div className="mt-8 border-t border-slate-200 pt-6">
        <button type="button" disabled className="btn-brand w-full sm:w-auto" aria-disabled="true">
          Registration opens soon
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 block text-sm font-semibold text-brand-600 underline-offset-4 hover:text-brand-900 hover:underline sm:ml-4 sm:mt-0 sm:inline">
          {open ? "Hide interest form" : "Register your interest"}
        </button>
        {open && (
          <div className="mt-6 rounded-sm bg-slate-50 p-5">
            <InterestForm kind={kind} />
          </div>
        )}
      </div>
    </article>
  );
}

export function Careers() {
  const { content } = useSiteContent();
  const { careers } = content;
  useDocumentTitle("Careers & Registration");

  return (
    <>
      <PageHero
        eyebrow="Careers & registration"
        title={careers.title}
        intro={careers.intro}
        image="/images/careers-workers.jpg"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Careers" }]}>
        <span className="badge bg-accent text-brand-900">{careers.launchLabel}</span>
      </PageHero>

      <section className="section">
        <div className="container-x">
          <SectionTitle eyebrow="Register with us" title="Choose how you want to join the network" intro="Contractors and workers register separately, because the verification and onboarding steps differ. Our registration app is launching soon. Register your interest now and we will contact you when it opens." />
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <RegistrationCard kind="CAREER_CONTRACTOR" data={careers.contractor} icon={Briefcase} />
            <RegistrationCard kind="CAREER_WORKER" data={careers.worker} icon={HardHat} />
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container-x grid gap-12 lg:grid-cols-3">
          <div>
            <SectionTitle eyebrow="Open roles" title="Join our team" />
            <p className="mt-5 text-sm text-slate-600">Looking for a permanent role in project, safety or finance? Send your CV through the contact page and mention the role.</p>
          </div>
          <ul className="divide-y divide-slate-200 rounded-sm border border-slate-200 bg-white lg:col-span-2">
            {careers.openings.map((job) => (
              <li key={job.title} className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold">{job.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5"><Users size={14} /> {job.department}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} /> {job.type}</span>
                    <span>{job.location}</span>
                  </p>
                </div>
                <Link to={`/contact?role=${encodeURIComponent(job.title)}`} className="btn-outline-dark self-start sm:self-auto">
                  Apply via contact
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
