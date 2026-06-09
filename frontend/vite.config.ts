import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: Number(process.env.VITE_DEV_PORT ?? 5173),
    host: process.env.VITE_DEV_HOST === "0.0.0.0" ? true : undefined,
    strictPort: true,
    // Avoid browsers reusing stale pre-bundled deps after container restarts.
    headers: {
      "Cache-Control": "no-store",
    },
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_PROXY ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
    watch:
      process.env.CHOKIDAR_USEPOLLING === "true"
        ? { usePolling: true, interval: 1000 }
        : undefined,
    hmr: process.env.VITE_HMR_CLIENT_PORT
      ? { clientPort: Number(process.env.VITE_HMR_CLIENT_PORT) }
      : undefined,
  },
});