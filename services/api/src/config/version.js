"use strict";

const { RELEASE_VERSION, MIN_SUPPORTED_CLIENT_VERSION } = require("@ananta/constants");

/** Public version contract returned by GET /api/v1/system/version. */
function getVersionInfo(client) {
  return {
    releaseVersion: RELEASE_VERSION,
    apiVersion: RELEASE_VERSION,
    policy: "EXACT_MATCH",
    minimumSupportedVersion: MIN_SUPPORTED_CLIENT_VERSION,
    latest: { mobile: RELEASE_VERSION, adminWeb: RELEASE_VERSION },
    yourClient: client ?? null,
    updateUrl: {
      // Where the strict popup sends the user. Configure per deployment;
      // mobile defaults to the store search-safe placeholder path "/".
      mobile: process.env.MOBILE_UPDATE_URL || "",
      adminWeb: process.env.ADMIN_UPDATE_URL || "/"
    },
    updateMessage:
      "A new version of Ananta Infratech is required. Please update to continue — your data is safe and nothing is lost.",
    serverTime: new Date().toISOString()
  };
}

/** "1.10.0" > "1.9.9" style comparison (no dependency needed). */
function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function isValidVersion(v) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(v ?? ""));
}

module.exports = { RELEASE_VERSION, MIN_SUPPORTED_CLIENT_VERSION, getVersionInfo, compareVersions, isValidVersion };
