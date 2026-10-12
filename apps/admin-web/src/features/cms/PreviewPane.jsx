import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { previewRoutes } from "@/features/cms/schema";
import { websitePreviewBase } from "@/features/cms/websitePreviewUrl";

/**
 * Live preview of the public website showing the UNSAVED draft.
 *
 * The website runs in ?preview=1 mode and listens for postMessage events:
 *   website → admin : { type: "cms:ready" }        (listener attached, send draft)
 *   admin → website : { type: "cms:content", content }
 *   admin → website : { type: "cms:navigate", path }
 * Each keystroke is debounced so the iframe does not reload while typing.
 */
export function PreviewPane({ draft }) {
  const iframeRef = useRef(null);
  const base = useMemo(() => websitePreviewBase(), []);
  const [path, setPath] = useState("/");
  const [device, setDevice] = useState("desktop");
  const [readyCount, setReadyCount] = useState(0);
  const routes = previewRoutes(draft);

  useEffect(() => {
    function onMessage(event) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      if (event.data?.type === "cms:ready") setReadyCount((n) => n + 1);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!readyCount) return undefined;
    const timer = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: "cms:content", content: draft }, "*");
    }, 150);
    return () => clearTimeout(timer);
  }, [draft, readyCount]);

  useEffect(() => {
    if (!readyCount) return;
    iframeRef.current?.contentWindow?.postMessage({ type: "cms:navigate", path }, "*");
  }, [path, readyCount]);

  const frameWidth = device === "mobile" ? "390px" : "100%";

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-steel-200 bg-steel-100/60 px-3 py-2.5">
        <select className="input !w-auto min-w-0 flex-1 !py-1.5 text-sm" value={path} onChange={(e) => setPath(e.target.value)} aria-label="Preview page">
          {routes.map((r) => (
            <option key={r.path} value={r.path}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="flex rounded-sm border border-steel-200 bg-white p-0.5">
          <button type="button" onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"} className={`rounded-sm p-1.5 ${device === "desktop" ? "bg-amber-50 text-amber-600" : "text-graphite-500"}`} aria-label="Desktop preview">
            <Monitor size={16} />
          </button>
          <button type="button" onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"} className={`rounded-sm p-1.5 ${device === "mobile" ? "bg-amber-50 text-amber-600" : "text-graphite-500"}`} aria-label="Mobile preview">
            <Smartphone size={16} />
          </button>
        </div>
        <a href={`${base}${path}`} target="_blank" rel="noreferrer" className="btn-ghost text-xs" title="Open the published site in a new tab">
          <ExternalLink size={13} /> Live site
        </a>
      </div>
      <div className="flex flex-1 justify-center overflow-auto bg-graphite-300/20 p-3">
        <iframe
          ref={iframeRef}
          title="Website draft preview"
          src={`${base}/?preview=1`}
          className="h-[calc(100vh-260px)] min-h-[560px] rounded-sm border border-steel-200 bg-white shadow-card transition-all"
          style={{ width: frameWidth, maxWidth: "100%" }}
        />
      </div>
      <p className="border-t border-steel-200 px-3 py-2 text-xs text-graphite-500">
        Preview shows your unsaved draft. Forms are disabled in preview. Publish to make changes live.
      </p>
    </div>
  );
}
