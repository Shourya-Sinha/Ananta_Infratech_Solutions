import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DEFAULT_CONTENT from "@ananta/cms-defaults/content.json";

/**
 * Supplies website content to every page.
 *
 * Normal visitors: published content from the API, falling back to the bundled
 * defaults if the API is unreachable or nothing has been published yet.
 *
 * Preview (?preview=1, opened by the admin CMS inside an iframe): content is
 * pushed from the admin editor via postMessage, so unsaved draft changes can
 * be reviewed page by page before publishing. Nothing is fetched from the API
 * in preview mode, and the public forms are disabled.
 */
const SiteContentContext = createContext({
  content: DEFAULT_CONTENT,
  preview: false,
  source: "default"
});

export function isPreviewRequested() {
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

export function SiteContentProvider({ children }) {
  const [preview] = useState(isPreviewRequested);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [source, setSource] = useState("default");
  const navigate = useNavigate();

  useEffect(() => {
    if (preview) return undefined;
    let cancelled = false;
    fetch("/api/v1/public/site")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        setContent({ ...DEFAULT_CONTENT, ...json.data.content });
        setSource(json.data.source);
      })
      .catch(() => {
        // API unreachable: keep the bundled defaults so the site still renders.
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);

  useEffect(() => {
    if (!preview) return undefined;

    function onMessage(event) {
      // Only trust the window that embeds us (the admin CMS).
      if (window.parent === window || event.source !== window.parent) return;
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "cms:content" && msg.content && typeof msg.content === "object") {
        setContent({ ...DEFAULT_CONTENT, ...msg.content });
        setSource("draft");
      }
      if (msg.type === "cms:navigate" && typeof msg.path === "string" && msg.path.startsWith("/")) {
        navigate(msg.path);
      }
    }

    window.addEventListener("message", onMessage);
    // Tell the admin the listener is ready so it can send the current draft.
    window.parent?.postMessage({ type: "cms:ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [preview, navigate]);

  return (
    <SiteContentContext.Provider value={{ content, preview, source }}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}
