"use strict";

/**
 * Strict version gate for official clients.
 *
 * Clients identify themselves on every request:
 *   x-client: mobile | admin-web
 *   x-app-version: 1.1.0
 * Total version control = EXACT match with the server RELEASE_VERSION.
 * An old (or newer, or unidentified-version) official client is rejected
 * with 426 Upgrade Required + code FORCE_UPDATE, and the client apps turn
 * that into a strict, non-dismissible update popup (mobile: update the
 * app; admin web: refresh to load the new UI). Requests WITHOUT an
 * x-client header (scripts, tests, third-party API use) are not blocked
 * but still receive the version headers.
 *
 * Always-allowed paths (so a blocked client can still learn the required
 * version): /system/version, /version, /status, /health*, docs.
 */
const { RELEASE_VERSION, getVersionInfo, isValidVersion, compareVersions } = require("../config/version");

const OFFICIAL_CLIENTS = new Set(["mobile", "admin-web"]);
const EXEMPT_SUFFIXES = ["/system/version", "/version", "/status", "/health", "/docs", "/openapi.json"];

function isExempt(req) {
  if (req.method === "OPTIONS") return true;
  return EXEMPT_SUFFIXES.some((suffix) => req.path === suffix || req.path.endsWith(suffix));
}

function versionGate(req, res, next) {
  res.setHeader("x-release-version", RELEASE_VERSION);
  res.setHeader("x-client-latest-version", RELEASE_VERSION);

  const client = String(req.headers["x-client"] ?? "").toLowerCase();
  if (!OFFICIAL_CLIENTS.has(client) || isExempt(req)) return next();

  const clientVersion = String(req.headers["x-app-version"] ?? "");
  const outdated = !isValidVersion(clientVersion) || compareVersions(clientVersion, RELEASE_VERSION) !== 0;
  if (!outdated) return next();

  const info = getVersionInfo(client);
  return res.status(426).json({
    success: false,
    error: {
      code: "FORCE_UPDATE",
      message: info.updateMessage,
      details: {
        client,
        currentVersion: clientVersion || null,
        requiredVersion: RELEASE_VERSION,
        minimumSupportedVersion: info.minimumSupportedVersion,
        updateUrl: client === "mobile" ? info.updateUrl.mobile : info.updateUrl.adminWeb,
        releaseVersion: RELEASE_VERSION
      }
    }
  });
}

module.exports = { versionGate, OFFICIAL_CLIENTS };
