import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000";

// When the API server isn't running, the proxy would otherwise fail every
// /api call with an empty 500. Instead, answer in the API's own
// {success:false,error} envelope so the UI can show "API server isn't
// running — start it with npm run dev:api" and the ApiStatusBanner can
// detect the outage from the error code.
//
// NOTE: this must hook the proxy's "error" event via `configure` — an
// `onError` key in the options object is silently ignored by Vite, and
// `configure` runs before Vite's own error listener, so our 503 lands
// first and Vite skips its empty-500 fallback (it still logs one line).
function configureApiProxy(proxy) {
  proxy.on("error", (err, _req, res) => {
    if (!res || res.headersSent || res.writableEnded) return;
    if (!("req" in res)) return; // WebSocket upgrade failure, not HTTP.
    try {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: "API_UNREACHABLE",
            message: `API server isn't reachable at ${API_PROXY_TARGET}. Start it with: npm run dev:api`,
          },
        })
      );
    } catch {
      // The client already went away — nothing left to do.
    }
  });
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    headers: {
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        configure: configureApiProxy
      },
      "/socket.io": {
        target: API_PROXY_TARGET,
        ws: true,
        changeOrigin: true
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
    headers: {
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  }
});
