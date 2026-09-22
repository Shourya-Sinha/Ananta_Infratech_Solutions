"use strict";

const { isOriginAllowed, parseAllowed } = require("../../src/config/cors");

describe("CORS origin allow-list", () => {
  it("parses a comma-separated list and drops blanks", () => {
    expect(parseAllowed(" https://admin.example.com, ,http://localhost:5173 ")).toEqual([
      "https://admin.example.com",
      "http://localhost:5173"
    ]);
  });

  it("allows every origin when CORS_ORIGIN is unset or *", () => {
    expect(isOriginAllowed("https://admin.example.com", undefined)).toBe(true);
    expect(isOriginAllowed("https://admin.example.com", "*")).toBe(true);
    expect(isOriginAllowed("https://preview.e2b.app", " * ")).toBe(true);
  });

  it("allows missing origins (same-origin navigation, curl, server-to-server)", () => {
    expect(isOriginAllowed(undefined, "https://admin.example.com")).toBe(true);
    expect(isOriginAllowed("", "https://admin.example.com")).toBe(true);
  });

  it("allows listed origins and local admin dev servers even when production is pinned", () => {
    const configured = "https://admin.ananta.example";
    expect(isOriginAllowed("https://admin.ananta.example", configured)).toBe(true);
    expect(isOriginAllowed("http://localhost:5173", configured)).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:4173", configured)).toBe(true);
    expect(isOriginAllowed("https://evil.example", configured)).toBe(false);
  });
});
