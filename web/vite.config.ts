import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api is proxied to the Node API so the session cookie is same-origin (no CORS, no third-party cookies).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true, // lets tunnels (ngrok / cloudflared) reach the dev server for phone testing
    proxy: { "/api": "http://localhost:4000" },
  },
});
