"use strict";

/**
 * Shared origin check for Express and Socket.IO.
 *
 * YouTube playback itself is an iframe, not a CORS request — the browser will
 * not apply Access-Control-Allow-Origin to www.youtube.com embeds. This check
 * is for the admin app calling our API (search, /media/youtube/config). A
 * missing admin origin here looks like "the video player is broken" because
 * search never returns anything to play.
 *
 * CORS_ORIGIN=* (the default) reflects whatever origin the browser sends.
 * A comma-separated list is an allow-list. Local admin dev servers are always
 * allowed so a production origin in .env does not break `npm run dev`.
 */

const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i;

function parseAllowed(raw) {
  return String(raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, configured) {
  if (!origin) return true;
  const value = String(configured ?? "").trim();
  if (!value || value === "*" || value === "true") return true;
  const allowed = parseAllowed(value);
  if (allowed.includes("*") || allowed.includes(origin)) return true;
  if (DEV_ORIGIN.test(origin)) return true;
  return false;
}

function corsOriginDelegate(configured) {
  return function corsOrigin(origin, callback) {
    if (isOriginAllowed(origin, configured)) {
      // `true` tells the cors package to reflect the request origin, which is
      // required when credentials are enabled (a literal "*" is rejected).
      callback(null, true);
      return;
    }
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[cors] Rejected origin ${origin}. Add it to CORS_ORIGIN (current: ${configured || "*"}).`
      );
    }
    callback(null, false);
  };
}

module.exports = {
  parseAllowed,
  isOriginAllowed,
  corsOriginDelegate
};
