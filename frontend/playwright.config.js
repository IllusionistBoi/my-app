import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const frontendDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(frontendDirectory, "../backend/poker_project");
const localPython =
  process.env.E2E_PYTHON ||
  (process.platform === "win32" ? "../.venv/Scripts/python.exe" : "python");
const apiUrl = "http://127.0.0.1:8011";
const frontendUrl = "http://127.0.0.1:4175";
const externalBaseUrl = process.env.E2E_BASE_URL?.replace(/\/+$/, "");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: externalBaseUrl || frontendUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: `"${localPython}" manage.py migrate --noinput && "${localPython}" manage.py runserver 127.0.0.1:8011 --noreload`,
          cwd: backendDirectory,
          env: {
            ...process.env,
            DJANGO_DEBUG: process.env.DJANGO_DEBUG || "true",
            DJANGO_SECRET_KEY:
              process.env.DJANGO_SECRET_KEY ||
              "local-e2e-only-secret-key-with-more-than-fifty-characters",
            DJANGO_ALLOWED_HOSTS:
              process.env.DJANGO_ALLOWED_HOSTS || "localhost,127.0.0.1",
            CORS_ALLOWED_ORIGINS:
              process.env.CORS_ALLOWED_ORIGINS || frontendUrl,
            CSRF_TRUSTED_ORIGINS:
              process.env.CSRF_TRUSTED_ORIGINS || frontendUrl,
            DATABASE_URL: process.env.DATABASE_URL || "sqlite:///e2e.sqlite3",
            DJANGO_SECURE_SSL_REDIRECT:
              process.env.DJANGO_SECURE_SSL_REDIRECT || "false",
            DB_SSL_REQUIRED: process.env.DB_SSL_REQUIRED || "false",
          },
          url: `${apiUrl}/api/ready/`,
          reuseExistingServer: false,
          timeout: 60_000,
        },
        {
          command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4175",
          cwd: frontendDirectory,
          env: {
            ...process.env,
            VITE_API_URL: `${apiUrl}/api`,
          },
          url: frontendUrl,
          reuseExistingServer: false,
          timeout: 60_000,
        },
      ],
});
