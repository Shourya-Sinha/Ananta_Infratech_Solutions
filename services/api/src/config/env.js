import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});

// Fail fast at boot if required env vars are missing/malformed.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().default(4000),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 chars"),

  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),

  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  IMAGEKIT_PUBLIC_KEY: z.string().min(1),
  IMAGEKIT_PRIVATE_KEY: z.string().min(1),
  IMAGEKIT_URL_ENDPOINT: z.string().min(1),

  CORS_ORIGIN: z.string().default("*"),

  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),

  SMS_PROVIDER: z.enum(["msg91", "none"]).default("none"),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_TEMPLATE_ID: z.string().optional(),

  PUSH_NOTIFICATIONS_ENABLED: z.coerce.boolean().default(true),

  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment configuration:",
      parsed.error.flatten().fieldErrors
    );

    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();



// import path from "node:path";
// import dotenv from "dotenv";
// import { z } from "zod";

// dotenv.config({
//   path: path.resolve(process.cwd(), "../../.env"),
// });


// Object.defineProperty(exports, "__esModule", {
//   value: true
// });
// exports.env = void 0;
// var _zod = require("zod");
// // Fail fast at boot if required env vars are missing/malformed — never let
// // a misconfigured server start silently and fail on the first request.
// const envSchema = _zod.z.object({
//   NODE_ENV: _zod.z.enum(["development", "test", "production"]).default("development"),
//   PORT: _zod.z.coerce.number().default(4000),
//   MONGODB_URI: _zod.z.string().min(1, "MONGODB_URI is required"),
//   JWT_SECRET: _zod.z.string().min(32, "JWT_SECRET must be at least 32 chars"),
//   JWT_ACCESS_EXPIRES_IN: _zod.z.string().default("15m"),
//   JWT_REFRESH_SECRET: _zod.z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
//   JWT_REFRESH_EXPIRES_IN: _zod.z.string().default("30d"),
//   REDIS_URL: _zod.z.string().min(1, "REDIS_URL is required"),
//   IMAGEKIT_PUBLIC_KEY: _zod.z.string().min(1),
//   IMAGEKIT_PRIVATE_KEY: _zod.z.string().min(1),
//   IMAGEKIT_URL_ENDPOINT: _zod.z.string().min(1),
//   CORS_ORIGIN: _zod.z.string().default("*"),
//   OTP_TTL_SECONDS: _zod.z.coerce.number().default(300),
//   OTP_MAX_ATTEMPTS: _zod.z.coerce.number().default(5),
//   // SMS gateway (optional — falls back to logging + dev-mode OTP passthrough if unset)
//   SMS_PROVIDER: _zod.z.enum(["msg91", "none"]).default("none"),
//   SMS_API_KEY: _zod.z.string().optional(),
//   SMS_SENDER_ID: _zod.z.string().optional(),
//   SMS_TEMPLATE_ID: _zod.z.string().optional(),
//   // Push notifications (optional — Expo push tokens, falls back to logging if unset)
//   PUSH_NOTIFICATIONS_ENABLED: _zod.z.coerce.boolean().default(true),
//   FIREBASE_SERVICE_ACCOUNT_JSON: _zod.z.string().optional()
// });
// function loadEnv() {
//   const parsed = envSchema.safeParse(process.env);
//   if (!parsed.success) {
//     // eslint-disable-next-line no-console
//     console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
//     process.exit(1);
//   }
//   return parsed.data;
// }
// const env = exports.env = loadEnv();


// Object.defineProperty(exports, "__esModule", {
//   value: true
// });
// exports.env = void 0;
// var _zod = require("zod");
// // Fail fast at boot if required env vars are missing/malformed — never let
// // a misconfigured server start silently and fail on the first request.
// const envSchema = _zod.z.object({
//   NODE_ENV: _zod.z.enum(["development", "test", "production"]).default("development"),
//   PORT: _zod.z.coerce.number().default(4000),
//   MONGODB_URI: _zod.z.string().min(1, "MONGODB_URI is required"),
//   JWT_SECRET: _zod.z.string().min(32, "JWT_SECRET must be at least 32 chars"),
//   JWT_ACCESS_EXPIRES_IN: _zod.z.string().default("15m"),
//   JWT_REFRESH_SECRET: _zod.z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
//   JWT_REFRESH_EXPIRES_IN: _zod.z.string().default("30d"),
//   REDIS_URL: _zod.z.string().min(1, "REDIS_URL is required"),
//   IMAGEKIT_PUBLIC_KEY: _zod.z.string().min(1),
//   IMAGEKIT_PRIVATE_KEY: _zod.z.string().min(1),
//   IMAGEKIT_URL_ENDPOINT: _zod.z.string().min(1),
//   CORS_ORIGIN: _zod.z.string().default("*"),
//   OTP_TTL_SECONDS: _zod.z.coerce.number().default(300),
//   OTP_MAX_ATTEMPTS: _zod.z.coerce.number().default(5),
//   // SMS gateway (optional — falls back to logging + dev-mode OTP passthrough if unset)
//   SMS_PROVIDER: _zod.z.enum(["msg91", "none"]).default("none"),
//   SMS_API_KEY: _zod.z.string().optional(),
//   SMS_SENDER_ID: _zod.z.string().optional(),
//   SMS_TEMPLATE_ID: _zod.z.string().optional(),
//   // Push notifications (optional — Expo push tokens, falls back to logging if unset)
//   PUSH_NOTIFICATIONS_ENABLED: _zod.z.coerce.boolean().default(true),
//   FIREBASE_SERVICE_ACCOUNT_JSON: _zod.z.string().optional()
// });
// function loadEnv() {
//   const parsed = envSchema.safeParse(process.env);
//   if (!parsed.success) {
//     // eslint-disable-next-line no-console
//     console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
//     process.exit(1);
//   }
//   return parsed.data;
// }
// const env = exports.env = loadEnv();