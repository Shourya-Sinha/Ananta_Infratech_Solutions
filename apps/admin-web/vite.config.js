import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

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
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000",
        changeOrigin: true
      },
      "/socket.io": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000",
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