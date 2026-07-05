import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const apiProxyTarget = process.env.DEV_API_PROXY_TARGET || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
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
    alias: {
      "@rive-app/canvas-lite": fileURLToPath(
        new URL("./src/test/riveRuntimeStub.js", import.meta.url),
      ),
      "@rive-app/react-canvas-lite": fileURLToPath(
        new URL("./src/test/riveRuntimeStub.js", import.meta.url),
      ),
    },
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
