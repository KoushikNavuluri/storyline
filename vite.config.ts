import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // During local development, `/api/*` is served by `vercel dev` or the local AI dev server.
    proxy: { "/api": "http://localhost:3001" },
  },
});
