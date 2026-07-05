# Planning Poker engineering handbook

This is the canonical project reference for humans and coding agents. If another document conflicts with this file, verify the source code and deployment configuration, then update both documents in the same change.

## 1. Product

Planning Poker provides short-lived collaborative estimation rooms.

Core workflows:

1. Create a room with a display name and room name.
2. Join through a session ID or shared deep link.
3. Vote with a planning-poker card or participate as a spectator.
4. See participation readiness without seeing other votes.
5. Let the host reveal a completed round.
6. Reset into the next round.
7. Let the host remove members or end the room.

Correctness and privacy are more important than preserving legacy API behavior.

## 2. Current operational status

- Frontend Vercel project: `my-app`
- Frontend production: `https://my-app-tau-seven-25.vercel.app`
- Frontend preview: `https://planning-poker-preview-ronit.vercel.app`
- Backend Vercel project: `planning-poker-api-ronit`
- Backend production: `https://planning-poker-api-ronit.vercel.app`
- Backend preview: `https://planning-poker-api-preview-ronit.vercel.app`
- Frontend framework/runtime: Vite / Node.js 24
- Backend framework/runtime: Django / Python 3.14
- Production database integration: Neon Free `planning-poker-prod`
- Preview/development database integration: Neon Free `planning-poker-preview`
- Vercel team: `ronits-projects-17727dad` on Hobby
- Default branch: `master`

Production and preview are live and use separate databases. The frontend's fixed production alias does not change between deployments. Unique generated deployment URLs are diagnostics/previews, not the public application address.

The former Render/SQLite deployment is retired and must not be used as a rollback target. A fresh Django signing key was generated for each Vercel environment; old capabilities are invalid.

## 3. Architecture

```text
Browser
  |
  | HTTPS
  v
Vercel CDN / React SPA
  |
  | same-origin /api rewrite
  v
Vercel Django / Python Function
  |
  | pooled TLS DATABASE_URL
  v
Neon Free PostgreSQL
```

The frontend is static. Business rules, authorization, hidden-vote policy, round state, and concurrency control belong to the backend.

Preview builds use a fixed preview API alias and a separate Neon project. Never point `VITE_API_URL` at production from a preview.

## 4. Repository map

```text
.
|-- frontend/
|   |-- public/                 Small static icons and web manifest
|   |-- src/                    React pages, API client, capability store, tests
|   |-- index.html              Vite SPA entry point
|   |-- vite.config.js          Build, test, local proxy, and size-budget config
|   |-- package.json
|   |-- package-lock.json
|   `-- vercel.json             Rewrites and platform headers/routes
|-- backend/
|   `-- poker_project/
|       |-- manage.py
|       |-- poker_project/      Django settings and root URLs
|       |-- session_management/ Domain models, API, migrations, tests
|       `-- requirements.txt
|-- .github/
|   |-- workflows/ci.yml
|   `-- dependabot.yml
|-- run-dev.bat
|-- README.md
|-- RUNNING.md
|-- AUTH_DOCUMENTATION.md
`-- tasks/                      Audit plan, findings, and lessons
```

Generated assets, environment files, virtual environments, databases, logs, bytecode, coverage, and platform-local state must remain untracked.

## 5. Runtime contract

| Layer | Supported baseline | Source of truth |
| --- | --- | --- |
| Frontend | Node.js 24, npm lockfile | `frontend/package.json`, CI, Vercel |
| Backend | Python 3.14.3 | `.python-version`, CI, Vercel |
| Framework | Supported Django 5.2 LTS patch | backend requirements |
| Database | Neon PostgreSQL | Vercel Marketplace integrations |
| WSGI runtime | Vercel zero-configuration Django runtime | `manage.py`, `vercel.json` |

Do not rely on a developer machine's global Node or Python version. Clean installs are the release standard.

## 6. Environment variables

### Backend

| Variable | Required | Purpose |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | Deployed environments | High-entropy Vercel Sensitive value. Use a different key in production and preview. Never commit or log it. |
| `DJANGO_DEBUG` | Yes | `false` in production; `true` only for explicit local development. |
| `DATABASE_URL` | Production/preview/CI | Pooled PostgreSQL connection string. Vercel injects it from the environment-scoped Neon integration. |
| `DJANGO_ALLOWED_HOSTS` | Deployed environments | Comma-separated hostnames. Current Vercel value is `.vercel.app`. |
| `CORS_ALLOWED_ORIGINS` | If cross-origin browser access is enabled | Comma-separated origins including scheme. Same-origin proxying should minimize this list. |
| `CSRF_TRUSTED_ORIGINS` | Cookie/session admin flows | Comma-separated HTTPS origins trusted for CSRF. |
| `DB_SSL_REQUIRED` | Optional | Defaults to `true` outside debug/tests; disable only for an explicitly local database. |
| `DB_CONN_MAX_AGE` | Optional | Persistent database connection lifetime; default `60` seconds. |
| `SESSION_TTL_SECONDS` | Optional | Room lifetime; default seven days. |
| `CAPABILITY_MAX_AGE_SECONDS` | Optional | Maximum signed capability age; room expiry still wins. |
| `API_ANON_RATE`, `API_USER_RATE` | Optional | General DRF throttle rates. |
| `API_SESSION_CREATE_RATE`, `API_SESSION_JOIN_RATE` | Optional | Anonymous room-entry throttle rates. |
| `API_NUM_PROXIES` | Optional | Trusted proxy count for client-IP throttling; production default `1`. |
| `VERCEL_GIT_COMMIT_SHA` | Vercel-provided | Exposed in health/version metadata after Git-backed deployments; do not override. |

Production settings must fail closed when a required secret or host is missing. Do not silently substitute a development key.

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Optional build-time value | API base. The default `/api` uses Vite's local proxy and Vercel's production rewrite. Preview must use an isolated staging API. |

Vite embeds `VITE_*` values into the public browser bundle. They can never contain secrets.

Vercel environment values must be explicitly scoped to Production, Preview, or Development. A preview must not inherit a production mutation endpoint.
When a Vercel preview has no staging target, the frontend deliberately blocks API calls rather than proxying mutations to production.

## 7. Local setup

### Backend

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend/poker_project/requirements.txt
Set-Location backend/poker_project
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Recommended local values:

```powershell
$env:DJANGO_SECRET_KEY="local-only-random-value-at-least-fifty-characters-long"
$env:DJANGO_DEBUG="true"
$env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
$env:CSRF_TRUSTED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

Set `DATABASE_URL` for production-equivalent PostgreSQL work.

### Frontend

```powershell
Set-Location frontend
npm ci
npm run dev
```

Vite serves `http://127.0.0.1:5173` and proxies `/api` to `http://127.0.0.1:8000`.
Use `run-dev.bat` only after installing both dependency sets.

## 8. Verification commands

Frontend:

```powershell
Set-Location frontend
npm ci
npm test
npm run build
npm audit --audit-level=high
npx playwright install chromium
npm run test:e2e
```

Backend:

```powershell
Set-Location backend/poker_project
python -m pip check
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py test --verbosity 2
python manage.py collectstatic --noinput
python manage.py check --deploy --fail-level WARNING
```

Run backend integration and concurrency tests against PostgreSQL, not only SQLite.

Never mark a deployment-ready task complete solely because a local development server starts.

## 9. CI policy

`.github/workflows/ci.yml` runs:

- repository hygiene checks;
- full-history secret scanning;
- locked frontend install, tests, and production build;
- PostgreSQL-backed backend install, migration drift check, migrations, tests, static collection, and Django deployment checks;
- two-browser Playwright coverage for private votes, reveal/reset synchronization, deep links, and 320px layout;
- npm high/critical audit gate;
- Python vulnerability audit gate.

Dependabot checks npm, pip, and GitHub Actions updates.

Required checks should be enabled in branch protection. Connect both Vercel projects to the repository with roots `frontend` and `backend/poker_project` after the clean history is pushed.

Do not waive a high/critical advisory silently. A temporary exception requires an owner, exploitability assessment, compensating control, and expiry date in a tracked issue.

## 10. API surface

API base: `/api/sessions/`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `create/` | Create room, host membership, and host capability atomically. |
| `POST` | `join/` | Join room and return participant capability atomically. |
| `GET` | `<session_id>/details/` | Return the authorized room view with unrevealed votes hidden. |
| `POST` | `<session_id>/cast_vote/` | Cast the authenticated member's vote. |
| `POST` | `<session_id>/clear_vote/` | Clear the authenticated member's vote. |
| `POST` | `<session_id>/make_spectator/` | Change the authenticated member's own spectator state. |
| `POST` | `<session_id>/flip_votes/` | Host-only reveal. |
| `POST` | `<session_id>/reset_votes/` | Host-only new round. |
| `POST` | `<session_id>/remove_user/` | Host-only participant removal. |
| `DELETE` | `<session_id>/delete_session/` | Host-only room deletion. |

Legacy participants/votes helper routes and global JWT obtain/refresh routes are intentionally absent.

### API invariants

- Canonicalize session IDs and display names consistently.
- Validate request bodies with action-specific serializers.
- Never accept actor identity or role from the request body.
- Return stable machine-readable error codes.
- Use `401`, `403`, `404`, `409`, and `429` consistently.
- Set `Cache-Control: no-store` on private room and capability responses.
- Add request IDs to responses and structured logs.
- Apply anonymous and member-scoped throttles.
- Bound names, room sizes, room lifetime, and payload size.

## 11. Identity and authorization

See `AUTH_DOCUMENTATION.md`.

Non-negotiable rules:

- A username is not authentication.
- Capabilities are high entropy and session scoped.
- Reads require active membership.
- Vote/spectator mutations are self-only.
- Reveal, reset, removal, and deletion are host-only.
- Removed or expired memberships cannot continue acting.
- Vote values remain private until authoritative reveal.
- Secrets and authorization headers are redacted from logs.

## 12. State and concurrency

The backend owns:

- `round_number`;
- `is_revealed`;
- participant membership and role;
- spectator state;
- whether each eligible participant has voted;
- revealed results.

Reset must atomically clear results, advance the round, and reopen voting. Reveal must atomically verify that every non-spectator has a valid card. Voting after reveal must fail.

On PostgreSQL, wrap JSON or row-based state transitions in `transaction.atomic()` and lock the authoritative room row with `select_for_update()`. Tests must prove simultaneous votes do not overwrite each other.

## 13. Frontend conventions

- The server response is authoritative; do not synthesize host/member permission locally.
- Store credentials by canonical session ID.
- Keep participant capabilities in `sessionStorage`, never in room links, query strings, logs, or global JWT state.
- All requests need timeout/cancellation behavior.
- Retry only safe/idempotent operations.
- Disable controls while the corresponding mutation is pending.
- Use native semantic controls and visible keyboard focus.
- Honor reduced-motion preferences.
- Provide explicit loading, empty, removed, expired, offline, and fatal states.
- Do not expose raw votes before reveal.
- Do not report clipboard success before the promise resolves.

## 14. Backend conventions

- Keep settings environment driven and fail closed in production.
- Put validation in serializers/domain services, not duplicated view branches.
- Keep permission checks adjacent to the state they protect.
- Use transactions for multi-step membership and round changes.
- Every model change includes a reviewed migration.
- Migrations must support both a clean database and upgrade from the last production schema.
- Run `python manage.py purge_expired_sessions` manually before releases or from a free scheduled workflow if room volume makes cleanup necessary.
- Log JSON to stdout; never write application logs to the ephemeral filesystem.
- Health endpoints do not expose secrets, database URLs, user data, or stack traces.

## 15. Health and observability

`/api/ready/` verifies database connectivity and is the backend readiness smoke-test target.

Recommended split:

- `/api/health/` — liveness and release identifier, no expensive dependencies.
- `/api/ready/` — database readiness using a bounded `SELECT 1`.
- `/api/version/` — deployed commit and environment metadata.

Production observability requires:

- structured request/error logs;
- correlation/request IDs across both Vercel projects;
- privacy-filtered exception monitoring;
- uptime checks for frontend, backend health, and a synthetic create/join/vote flow;
- alerts for 5xx rate, latency, failed deploys, failed health checks, and database capacity.

Vercel Hobby retains a limited runtime-log window. Use the dashboard promptly after a failure.

## 16. Vercel deployment

Project settings:

- Framework: Vite
- Root Directory: `frontend`
- Node.js: `24.x`
- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`

Production builds use `/api`. Rewrites preserve the path and forward to `planning-poker-api-ronit.vercel.app`.

Release flow:

1. Open a pull request and wait for all required CI checks.
2. Build a Vercel preview from the exact commit.
3. Verify home, deep-link refresh, API proxy, browser console, mobile layout, keyboard flow, and a complete room workflow against staging.
4. Build production separately when environment-specific Vite values differ from Preview; otherwise promote the exact tested artifact.
5. Confirm deployment metadata references the intended clean Git SHA.
6. Scan early errors and run smoke tests.

CLI deployments from a dirty tree were used only for this initial recovery. Normal releases must come from reviewed Git commits.

## 17. Backend Vercel deployment

Backend project settings:

- Project: `planning-poker-api-ronit`
- Framework: Django
- Git Root Directory after connection: `backend/poker_project`
- Python: `3.14` from `.python-version`
- Region: `lhr1`
- Production alias: `planning-poker-api-ronit.vercel.app`
- Preview alias: `planning-poker-api-preview-ronit.vercel.app`
- Deployment protection: disabled so the browser can call the preview API; do not put private data in preview.

Vercel detects `manage.py`, the WSGI application, requirements, and static files. `vercel.json` pins the framework and region.

Migrations are intentionally separate from builds:

1. Pull or inject the target environment variables without printing secrets.
2. Set a temporary local `DJANGO_SECRET_KEY` for the migration process if the deployed Sensitive value cannot be downloaded.
3. Run `python manage.py migrate --noinput`.
4. Run `python manage.py migrate --check`.
5. Deploy the backend and verify `/api/health/`, `/api/ready/`, and `/api/version/`.

## 18. Database environments

The Vercel Marketplace provisions two Neon Free resources in London:

| Environment | Resource | Vercel targets |
| --- | --- | --- |
| Production | `planning-poker-prod` | Production |
| Preview | `planning-poker-preview` | Preview, Development |

The initial databases intentionally started empty because the previous deployment had no real users or retention requirement. Clean PostgreSQL migrations through `0009` were verified on both databases.

Do not connect Preview to the production resource. Do not commit downloaded `.env.*.local` files.

## 19. Backups and restore

- Neon Free currently includes a short six-hour restore/time-travel window and 0.5 GB storage per project.
- This is acceptable for a disposable personal project, not for valuable or regulated data.
- Before risky schema changes, make a logical export to encrypted local storage if any data matters.
- Restrict backup access and encrypt exports.
- Test restore/export procedures before accepting real user data.
- Verify restored row counts, constraints, application health, and a representative room workflow.

If retention requirements grow, stop and choose a paid backup plan explicitly; never upgrade automatically.

## 20. Rollback

Frontend rollback:

1. Stop promotion if preview verification fails.
2. Reassign the production alias to the last known-good clean Vercel artifact.
3. Confirm API compatibility and run smoke tests.

Backend rollback:

1. Prefer forward fixes and expand/contract migrations.
2. Reassign the backend production alias to the last known-good Vercel deployment only if it remains schema compatible.
3. Do not reverse a destructive migration without a tested reverse operation and backup.
4. If data is damaged, isolate writes, restore to a new database, validate it, then switch `DATABASE_URL`.

Record the deployed frontend SHA, backend SHA, schema migration, database restore point, operator, and timestamps for every production release.

## 21. Incident response

For secret or data exposure:

1. Contain access and preserve evidence.
2. Rotate the exposed secret and dependent credentials.
3. Invalidate sessions/capabilities.
4. Reset privileged accounts.
5. Review Git, Vercel, Neon, and application logs.
6. Determine affected data and time window.
7. Notify affected parties when legally or contractually required.
8. Purge exposed artifacts from active systems and Git history.
9. Document root cause, corrective actions, and prevention.

For an outage:

1. Check Vercel deployment status and frontend availability.
2. Check backend Vercel health, deployment events, logs, and Neon status.
3. Correlate by request ID and deployed SHA.
4. Roll back only with schema compatibility.
5. Keep a timeline and publish a concise post-incident review.

## 22. Git history cleanup

The old database and signing key must not remain in the published history. This personal project has no collaborators or data-retention requirement, so the approved cleanup is a new single-root history containing only the reviewed production-ready tree.

After the replacement push:

- confirm the remote default branch points to the clean root;
- rerun full-history secret scanning;
- delete obsolete remote branches/tags if any;
- reconnect both Vercel projects to the correct monorepo roots.

## 23. Known cutover constraints

- Vercel Hobby is free only for personal/non-commercial use.
- Hobby limits include finite monthly CPU, memory, requests, bandwidth, builds, and log retention. Exceeding many Hobby limits pauses the affected feature until reset rather than charging a Hobby billing cycle.
- Neon Free currently includes 100 CU-hours and 0.5 GB storage per project with a six-hour restore window.
- Preview deployments are intentionally public so the frontend can call the preview API without paid Deployment Protection exceptions.
- The initial recovery deployment came from the audited local tree; Git-backed deployment becomes canonical after the clean history push.
- A purchased custom domain is optional and not free. The fixed `*.vercel.app` production alias is the supported $0 domain.
- External uptime monitoring is optional. Do not enable paid Vercel monitoring, custom-domain registration, or database upgrades without explicit approval.

## 24. Documentation maintenance

Update this file whenever a change affects:

- runtime versions or package managers;
- environment variables;
- API routes or authorization;
- data model or migration policy;
- CI requirements;
- Vercel/Neon configuration;
- backup, restore, rollback, or incident response.

Use `README.md` for onboarding, `RUNNING.md` for the short local runbook, and `AUTH_DOCUMENTATION.md` for the security model. Avoid duplicating implementation details elsewhere.
