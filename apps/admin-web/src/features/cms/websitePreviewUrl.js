/**
 * Address of the public website dev server (default port 5174), used by the
 * CMS preview iframe.
 *
 * Priority:
 *  1. VITE_WEBSITE_PREVIEW_URL (set this in production, e.g. https://www.example.com)
 *  2. Sandbox-style hosts where each port is a subdomain ("5173-<id>.domain")
 *     → swap the leading port for the website's port.
 *  3. Local dev → same hostname, port 5174.
 */
export function websitePreviewBase() {
  const configured = import.meta.env.VITE_WEBSITE_PREVIEW_URL;
  if (configured) return configured.replace(/\/$/, "");

  const { protocol, hostname } = window.location;
  const subdomainPort = hostname.match(/^\d+-(.+)$/);
  if (subdomainPort) return `${protocol}//5174-${subdomainPort[1]}`;
  return `${protocol}//${hostname}:5174`;
}
