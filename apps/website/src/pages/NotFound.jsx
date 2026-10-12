import { Link } from "react-router-dom";
import { useDocumentTitle } from "@/lib/helpers";

export function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <section className="section">
      <div className="container-x text-center">
        <p className="font-display text-7xl font-extrabold text-accent">404</p>
        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">This page could not be found.</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">The page may have moved, or the link may be out of date.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-brand">
            Back to home
          </Link>
          <Link to="/contact" className="btn-outline-dark">
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
