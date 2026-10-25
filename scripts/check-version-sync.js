"use strict";

/**
 * Total-version-control guard: fails loudly if any client/server version
 * drifts from the single release version in @ananta/constants. Run via
 * `npm run version:check` (also part of `npm run verify`).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const { RELEASE_VERSION } = require(path.join(root, "packages/constants/src/version"));

const checks = [
  ["apps/mobile/app.json (expo.version)", JSON.parse(fs.readFileSync(path.join(root, "apps/mobile/app.json"), "utf8")).expo.version],
  ["apps/mobile/package.json", JSON.parse(fs.readFileSync(path.join(root, "apps/mobile/package.json"), "utf8")).version],
  ["apps/admin-web/package.json", JSON.parse(fs.readFileSync(path.join(root, "apps/admin-web/package.json"), "utf8")).version],
  ["services/api/package.json", JSON.parse(fs.readFileSync(path.join(root, "services/api/package.json"), "utf8")).version],
  ["package.json (root)", JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version]
];

let failed = false;
for (const [label, version] of checks) {
  const ok = version === RELEASE_VERSION;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${version}${ok ? "" : `  (expected ${RELEASE_VERSION})`}`);
  if (!ok) failed = true;
}
if (failed) {
  console.error(`\nVersion drift! Bump every version above to ${RELEASE_VERSION} (or bump RELEASE_VERSION and all of them together).`);
  process.exit(1);
}
console.log(`\nAll clients and the server are locked to release ${RELEASE_VERSION}.`);
