"use strict";

/**
 * TOTAL VERSION CONTROL — one release train for the whole product.
 *
 * API, Admin Web and Mobile all ship on the SAME release version. Every
 * official client sends `x-client` + `x-app-version` on each API request;
 * the API (middleware/versionGate) compares it to RELEASE_VERSION and, on
 * any mismatch, rejects with HTTP 426 + code FORCE_UPDATE. The clients
 * react with a STRICT, non-dismissible popup:
 *   - Mobile  → "Update the app" (opens the store / update link)
 *   - Admin   → "Refresh the admin panel" (hard reload to the new UI)
 *
 * HOW TO RELEASE: bump RELEASE_VERSION here AND `expo.version` in
 * apps/mobile/app.json together (npm run version:check enforces they
 * match), bump the workspace package versions, deploy API + Admin Web,
 * then publish the mobile build. Old clients are blocked until updated.
 */
const RELEASE_VERSION = "1.1.0";

/** Oldest client release still allowed to talk to this API. */
const MIN_SUPPORTED_CLIENT_VERSION = "1.1.0";

exports.RELEASE_VERSION = RELEASE_VERSION;
exports.MIN_SUPPORTED_CLIENT_VERSION = MIN_SUPPORTED_CLIENT_VERSION;
