import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The public website talks to the same API as the admin panel. In dev, /api is
// proxied to the API server so the browser only ever sees this origin.
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    },
    // Force one copy of React and the router in the bundle. Without this, a
    // hoisted react-router can load a different React than react-dom, which
    // breaks every hook at runtime ("Invalid hook call").
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"]
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true
      }
    }
  }
});
