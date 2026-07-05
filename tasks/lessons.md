# Lessons

[2026-07-05] | Assumed the deployed SQLite database might contain user data that required a coordinated preservation cutover | Verify whether deployed data has real users or retention value before making data preservation a release blocker.
[2026-07-05] | Used `fileURLToPath(import.meta.url)` to locate a fixture inside a Vitest module, but Vite transformed it into a non-file URL | Resolve repository-level test fixtures from the test working directory when the runner bundles modules for a browser-like environment.
