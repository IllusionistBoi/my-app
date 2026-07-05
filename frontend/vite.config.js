import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 500,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    restoreMocks: true,
    clearMocks: true,
  },
});
