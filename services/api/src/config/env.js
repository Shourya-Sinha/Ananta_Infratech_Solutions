"use strict";

// Environment loader — CommonJS like every other backend file, so it can be
// require()d from anywhere (an ESM-only file here crashes the whole API with
// ERR_REQUIRE_ESM on Node versions without require(esm) support).

const path = require("node:path");
const dotenv = require("dotenv");
const { z } = require("zod");

// This file lives at services/api/src/config/, so:
//   ../../../../.env -> <repo-root>/.env   (primary config)
//   ../../.env       -> services/api/.env   (optional service-level gaps)
dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});

// Also load services/api/.env when present. dotenv never overrides variables
// that are already set, so repo-root values win and this file only fills gaps
// (e.g. YOUTUBE_API_KEY placed next to the service instead of at the root).
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

// Fail fast at boot if required env vars are missing/malformed — never let
// a misconfigured server start silently and fail on the first request.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  PORT: z.coerce.number().default(4000),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),

  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),

  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  IMAGEKIT_PUBLIC_KEY: z.string().min(1),
  IMAGEKIT_PRIVATE_KEY: z.string().min(1),
  IMAGEKIT_URL_ENDPOINT: z.string().min(1),

  CORS_ORIGIN: z.string().default("*"),

  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),

  // SMS gateway (optional — falls back to logging + dev-mode OTP passthrough if unset)
  SMS_PROVIDER: z.enum(["msg91", "none"]).default("none"),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_TEMPLATE_ID: z.string().optional(),

  // Push notifications (optional — Expo push tokens, falls back to logging if unset)
  PUSH_NOTIFICATIONS_ENABLED: z.coerce.boolean().default(true),

  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // Optional. When set, the admin video search uses the official YouTube Data
  // API; without it the service falls back to parsing the public results page.
  YOUTUBE_API_KEY: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    // eslint-disable-next-line no-console
    console.error("   Copy .env.example to .env at the repo root and fill in real values, then restart the API.");
    process.exit(1);
  }

  return parsed.data;
}

const env = loadEnv();

module.exports = { env, loadEnv };
