"use strict";

/*
 * Total version control: official clients (mobile / admin-web) must run
 * EXACTLY the server release version; anything else gets 426 FORCE_UPDATE
 * so the client can show its strict update popup. Unlabelled API traffic
 * (scripts/tests) is not blocked.
 */
const { versionGate } = require("../../src/middleware/versionGate");
const { RELEASE_VERSION } = require("../../src/config/version");

function run({ client, version, path = "/workers" }) {
  const req = { method: "GET", path, headers: {} };
  if (client) req.headers["x-client"] = client;
  if (version) req.headers["x-app-version"] = version;
  const res = {
    headers: {}, statusCode: 200, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let nextCalled = false;
  versionGate(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

describe("versionGate (strict exact-match)", () => {
  test("matching mobile client passes and receives version headers", () => {
    const { res, nextCalled } = run({ client: "mobile", version: RELEASE_VERSION });
    expect(nextCalled).toBe(true);
    expect(res.headers["x-release-version"]).toBe(RELEASE_VERSION);
  });

  test("OLD mobile version is blocked with 426 FORCE_UPDATE + required version", () => {
    const { res, nextCalled } = run({ client: "mobile", version: "1.0.0" });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(426);
    expect(res.body.error.code).toBe("FORCE_UPDATE");
    expect(res.body.error.details).toMatchObject({ client: "mobile", currentVersion: "1.0.0", requiredVersion: RELEASE_VERSION });
  });

  test("old Admin Web (refresh case) is blocked the same way", () => {
    const { res, nextCalled } = run({ client: "admin-web", version: "0.9.0" });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(426);
    expect(res.body.error.details.client).toBe("admin-web");
  });

  test("official client with NO version header counts as old and is blocked", () => {
    const { res, nextCalled } = run({ client: "mobile" });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(426);
  });

  test("requests without an x-client header are not blocked (scripts/tests)", () => {
    const { nextCalled } = run({});
    expect(nextCalled).toBe(true);
  });

  test("/system/version is always reachable so blocked clients can learn the required version", () => {
    const { nextCalled } = run({ client: "mobile", version: "1.0.0", path: "/system/version" });
    expect(nextCalled).toBe(true);
  });
});
