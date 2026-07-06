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
- Frontend production: `https://planning-poker-ronit.vercel.app`
- Frontend compatibility alias: `https://my-app-tau-seven-25.vercel.app`
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

The backend project is intentional. It runs Django and PostgreSQL-backed room state while the frontend project serves React. Opening the backend root returns a service-status payload and the frontend address; it is not a second copy of the website.

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
|-- PROJECT.md                Product, visual system, Rive, motion, and release record
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
| `CORS_ALLOWED_ORIGIN_REGEXES` | Preview only | Comma-separated regexes matching allowed browser origins. Use on Preview (disposable, no private data) because Vercel preview frontends get a fresh hostname each deploy; e.g. `^https://.*-ronits-projects-17727dad\.vercel\.app$`. Leave empty in production (served same-origin). |
| `PUBLIC_APP_URL` | Backend | Public browser application linked from the API landing response. Defaults to the fixed free production alias. |
| `CSRF_TRUSTED_ORIGINS` | Cookie/session admin flows | Comma-separated HTTPS origins trusted for CSRF. |
| `DB_SSL_REQUIRED` | Optional | Defaults to `true` outside debug/tests; disable only for an explicitly local database. |
| `DB_CONN_MAX_AGE` | Optional | Persistent database connection lifetime; default `60` seconds. |
| `SESSION_TTL_SECONDS` | Optional | Room lifetime; default seven days. |
| `SESSION_MAX_PARTICIPANTS` | Optional | Maximum active members per room; default `50`. `join/` returns `409 room_full` past it. |
| `CAPABILITY_MAX_AGE_SECONDS` | Optional | Maximum signed capability age; room expiry still wins. |
| `API_ANON_RATE`, `API_USER_RATE` | Deprecated | No longer applied. The blanket per-request throttle was removed on 2026-07-06 so the room poll does not write to the DB-backed cache on every call; create/join keep their own scoped throttles. |
| `API_SESSION_CREATE_RATE`, `API_SESSION_JOIN_RATE` | Optional | Anonymous room-entry throttle rates, now counted in a shared `DatabaseCache`. |
| `API_NUM_PROXIES` | Optional | Trusted proxy count for client-IP throttling; production default `1`. |
| `VERCEL_GIT_COMMIT_SHA` | Vercel-provided | Exposed in health/version metadata after Git-backed deployments; do not override. |

Production settings must fail closed when a required secret or host is missing. Do not silently substitute a development key.

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Optional build-time value | API base. The default `/api` uses Vite's local proxy and Vercel's production rewrite. Preview must use an isolated staging API. |
| `DEV_API_PROXY_TARGET` | Optional local-process value | Overrides Vite's development proxy target for production-like review against the isolated preview API. It is not a `VITE_*` value and is not exposed to browser code. |

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
- Apply IP-scoped throttles to the unauthenticated entry points (`create`/`join`), backed by a shared cache. **Fixed 2026-07-06: throttle counters now use a Neon-backed `DatabaseCache` (`settings.CACHES`, table provisioned by migration `0011_cache_table`) so they hold across serverless instances instead of the old per-process `LocMemCache`. The blanket per-request anon/user throttle was removed so the periodic room poll does not write to the cache table on every call. See §25 finding 1.**
- Bound names, room size, room lifetime, and payload size. **Fixed 2026-07-06: `join/` now enforces `SESSION_MAX_PARTICIPANTS` (default 50) and returns `409 room_full`. See §25 finding 2.**

## 11. Identity and authorization

See `AUTH_DOCUMENTATION.md`.

Non-negotiable rules:

- A username is not authentication.
- Capabilities are high entropy and session scoped.
- Reads require active membership.
- Vote/spectator mutations are self-only.
- Reveal, reset, removal, and deletion are host-only.
- Removed or expired memberships cannot continue acting.
- Vote values remain private until authoritative reveal. **Fixed 2026-07-06: the Django admin now `exclude`s `votes`/`vote_results`/`capability_digest` from its forms and disables add, so that access path no longer discloses ballots. See §25 finding 5.**
- Secrets and authorization headers are redacted from logs. **Fixed 2026-07-06: `logging.py`'s `JsonFormatter` now structurally scrubs `Bearer`/`Authorization` token substrings from messages and tracebacks, in addition to caller discipline. See §25 finding 8.**

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
- Keep the single-accent warm-black/orange visual system and self-hosted Clash Display/Geist typography coherent across every route.
- Keep `TeddyMascot` isolated from form/page state except for its small input prop contract; preserve its CSS fallback and reduced-motion pause.
- Keep `WelcomeIntro` homepage-only, skippable, timestamp-driven and absent from direct room links. Reduced-motion users must bypass it.
- Teddy pointer tracking must not use React state. Its periodic privacy pose may use low-frequency state, but form focus and typing must not control the mascot.
- Use the Rive celebration only for meaningful state changes. Frequent actions need fast tactile feedback, not long animation.
- Animate transform and opacity; gate hover transforms behind fine-pointer media queries.
- Preserve the 300 KB largest-JavaScript budget. The 700 KB total budget explicitly includes the restored Rive file and self-hosted fonts.
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

- `/` — public service landing response identifying the API and linking to `PUBLIC_APP_URL`.
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
`.github/workflows/uptime.yml` performs a free six-hour availability/readiness check using standard GitHub-hosted runners. GitHub can automatically disable scheduled workflows in public repositories after 60 days without repository activity; re-enable it from the Actions tab if that occurs.

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
- Git-backed deployments from the clean `master` history are canonical. Do not use older dirty CLI artifacts as rollback candidates.
- A purchased custom domain is optional and not free. `planning-poker-ronit.vercel.app` is the primary supported $0 domain; `my-app-tau-seven-25.vercel.app` remains a compatibility alias.
- The free GitHub Actions uptime workflow provides basic availability checks, not an SLA or full error-monitoring service. Do not enable paid Vercel monitoring, custom-domain registration, or database upgrades without explicit approval.

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

## 25. Audit findings (2026-07-06)

Senior full-stack review of the deployed Hobby-tier app. Ordered by impact. Each item is what's
wrong, where, why it matters, and the fix. Fixes are free-tier compatible — none require a paid
add-on. Where a finding contradicts an earlier section, that section was corrected in place
(§10 throttles + room size, §11 vote privacy + log redaction).

Reviewer confidence: every claim below was verified against the source this session. One reported
"HIGH" bug (RevealBurst animation not replaying) was investigated and **dismissed** — `RevealBurst`
returns `null` when `burstKey` is falsy and `RoomPage` resets `burstKey` to `null` 1600 ms after each
reveal (`RoomPage.jsx:288-291`), so the burst node fully unmounts between reveals and every reveal is
a fresh mount. Not a bug.

### Resolution status (updated 2026-07-06)

All findings below were remediated the same day except #7 (deliberately deferred). The finding
bodies are kept as the record of *why*; the changes that landed:

- **1 — Fixed.** Added `CACHES` DatabaseCache on Neon (`settings.py`), migration `0011_cache_table` (`createcachetable`), and removed the blanket anon/user throttle so the poll doesn't write per request. Create/join keep scoped throttles.
- **2 — Fixed.** `join_session` enforces `SESSION_MAX_PARTICIPANTS` (default 50) inside the locked transaction → `409 room_full`. New test `test_room_rejects_joins_past_the_participant_cap`.
- **3 — Fixed.** Poll interval is now state-aware: 5 s while a round is open, 9 s once revealed (`RoomPage.jsx` `pollIntervalFor`). Overlap on visibility toggles is guarded by an `inFlight` flag (also finding 10).
- **4 — Fixed.** Added `SessionMembership.display_name` (migration `0010`); serializer keeps the casefolded username as the identity key but preserves original case for display; API returns `display_names` + `created_by_display_name` + `current_user.display_name`; frontend renders those with a plain-username fallback. New tests cover casing on create and join.
- **5 — Fixed.** `admin.py` now `exclude`s `votes`/`vote_results`/`capability_digest` and disables add.
- **6 — Fixed.** Added deterministic `test_cast_vote_acquires_a_row_lock` (asserts `FOR UPDATE` via `CaptureQueriesContext`); fails if `select_for_update` is dropped. The probabilistic two-thread test is retained.
- **7 — Deferred.** Self-hosting `rive.wasm` risks the 700 KB budget and needs binary vendoring + a build measurement; the existing pinned URL + fallback CDN + graceful CSS fallback keep the risk low. Do this deliberately with a bundle re-measure, not as a drive-by.
- **8 — Fixed.** `JsonFormatter` scrubs `Bearer`/`Authorization` token substrings; new `test_bearer_tokens_and_auth_headers_are_redacted`.
- **9 — Fixed.** The mascot success/error signal effect is now guarded by `prefersReducedMotionRef`.
- **10 — Fixed (partial).** `newerSession` compares `updated_at` numerically (`Date.parse`); poll overlap guarded (finding 3); added `test_removed_member_token_cannot_mutate` and `test_expired_session_rejects_mutations`. Migration 0009's one-way `RunPython.noop` is left as-is and documented here as intentional.

Verification: backend suite green (31 passed, 2 Postgres-only lock tests skip on SQLite and run in CI); `makemigrations --check` clean; `check --deploy` clean; migrations apply on a fresh DB. The frontend unit suite was **not** run locally (the machine has Node 20.9, below the project's Node 24 requirement for vitest 4 / vite 8); it runs in CI. Changes were kept backward-compatible with the existing frontend mocks (display-name helpers fall back to the plain username).

### 1. Rate limiting is effectively a no-op on Vercel serverless (HIGH)
- **Where:** `poker_project/settings.py` `REST_FRAMEWORK` throttles (anon 120/min, user 600/min, `session_create` 20/hour, `session_join` 60/hour); `session_management/throttles.py`. There is **no `CACHES` block anywhere** (verified by grep), so Django falls back to per-process `LocMemCache`.
- **Why it matters:** DRF `SimpleRateThrottle` stores counters in the default cache. On Vercel each function invocation may hit a different warm instance and cold starts wipe memory, so counters are never shared. The throttles hold within one warm instance but reset constantly and are bypassable under concurrency — i.e. they fail exactly when abuse (room-creation floods, join enumeration) is happening. This also weakens the session-ID enumeration defense. Directly contradicts the §10 "apply throttles" invariant.
- **Fix (free):** add a `DatabaseCache` on the existing Neon Postgres — `CACHES = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "poker_throttle_cache"}}` plus `manage.py createcachetable` (add to the deploy/migration step). Shared across all instances, $0. Caveat: it adds one DB write per throttled request. Keep the `session_create`/`session_join` scoped throttles (low volume); **drop or greatly relax the blanket `anon`/`user` throttles** so the 4 s poll (finding 3) doesn't write to the cache table on every request and burn Neon CU.

### 2. No cap on participants per room (MED)
- **Where:** `views.py` `join_session` (218-273) — no membership-count check (verified: grep for any room-size/participant limit returns nothing; no `DATA_UPLOAD_MAX_MEMORY_SIZE` override either).
- **Why it matters:** room state lives in the `Session.votes`/`vote_results` JSON blobs, which grow per participant. With finding 1's throttle ineffective, a room can be inflated to thousands of members → large JSON, slow serialization, and every 4 s poll returns a bloated payload amplified across all pollers (Neon storage + Vercel egress). Contradicts the §10 "bound room sizes" invariant.
- **Fix (free):** in the existing locked transaction, `if SessionMembership.objects.filter(session=session, is_active=True).count() >= MAX_ROOM (e.g. 50): raise Conflict(code="room_full")` before creating the membership.

### 3. 4-second polling cost vs Neon Free / Vercel Hobby (MED)
- **Where:** `RoomPage.jsx:28` `POLL_INTERVAL_MS = 4_000`; poll loop 296-359. The architecture is correct for Hobby — polling, **not** websockets/SSE (serverless functions have max durations and would kill long-lived connections; do not "add websockets"). Polling already pauses when the tab is hidden, offline, or an action is in flight (lines 320-323), which is good.
- **Why it matters:** each active participant GETs `/details/` every 4 s = 15 req/min each (~3 Neon queries per call). A 6-person room ≈ 90 req/min ≈ 5,400 req/hr. Sustained multi-room use can pressure Neon Free (100 CU-hours) and Hobby invocation limits. There is no adaptive backoff — a revealed/idle room polls at the same 4 s even though nothing changes until the host resets.
- **Fix (free):** raise the interval to 6–8 s; back off (e.g. to 10–15 s) while `is_revealed` is true; optionally short-circuit unchanged polls with an `updated_at`/ETag check. Document the cost tradeoff (currently undocumented).

### 4. Participant display names are force-lowercased (MED, UX quality)
- **Where:** `serializers.py:12-18` `normalize_username` returns `" ".join(value.split()).casefold()`; every view stores/renders that value (`_serialize_session`). Room names are only whitespace-normalized (case preserved), so the two are inconsistent.
- **Why it matters:** "Alice Smith" is shown to the whole room as "alice smith". Purely cosmetic but visible on every screen. (Global `User` rows keyed by the casefolded name are also shared across all sessions and never cleaned — `purge_expired_sessions` deletes only Sessions — so the `User` table grows unbounded; low priority for a disposable app.)
- **Fix:** keep the casefolded value as the uniqueness/lookup key but persist and display an original-case display name (e.g. a `display_name` on `SessionMembership`, or store original case on `User.first_name` and render that).

### 5. Django admin exposes raw votes and capability digests (MED, privacy)
- **Where:** `admin.py` — `SessionAdmin` sets no `fields`/`exclude`, so the default change form renders **all** model fields, including `votes` and `vote_results` (raw per-player values, even before reveal). `SessionMembershipAdmin.readonly_fields` includes `capability_digest` (readonly = still displayed). Admin is also wired up (`poker_project/urls.py:9`) though the app has no admin workflow and no superuser is documented.
- **Why it matters:** any staff/superuser can view unrevealed votes and every member's capability digest via `/admin/`, contradicting the §11/§13 "votes private until reveal" rule for that access path. Latent today (no superuser) but the surface exists.
- **Fix (free):** simplest — remove `django.contrib.admin` from `INSTALLED_APPS` and drop the admin URL. If admin is kept, add `exclude = ("votes", "vote_results")` to `SessionAdmin`, drop `capability_digest` from the membership form, and restrict with `has_view_permission`.

### 6. Concurrency guarantee is asserted but not deterministically proven (MED, test quality)
- **Where:** `tests.py:548-593` `ConcurrentVoteTests.test_simultaneous_votes_are_not_lost` (Postgres-only). The production code is correct — mutations use `transaction.atomic()` + `select_for_update()` on the session row (`views.py`), and the concurrency model is sound.
- **Why it matters:** the test casts votes as two *different* users and asserts both `has_voted`, which is the right lost-update postcondition, but `ThreadPoolExecutor.map` does not force the two read-modify-write windows to overlap inside the locked section. If timing serializes them, the test passes even with the lock removed — so it does not reliably guard against a regression. §12 states tests "must prove" this; today they exercise it probabilistically.
- **Fix:** force overlap with a `threading.Barrier`/`Event` released only after the row lock is held but before commit, or wrap the requests in `CaptureQueriesContext` and assert a `FOR UPDATE` was emitted. Then deleting `select_for_update` fails the test.

### 7. Rive WASM runtime fetched from third-party CDNs at runtime (LOW/MED, supply chain)
- **Where:** `TeddyMascot.jsx:16-21` — module-scope `RuntimeLoader.setWasmUrl("https://unpkg.com/@rive-app/canvas-lite@2.38.4/rive.wasm")` + jsdelivr fallback; CSP (`vercel.json:33`) is loosened to allow those CDNs in `connect-src` plus `'wasm-unsafe-eval'`. `package.json` also declares both `@rive-app/canvas-lite` and `@rive-app/react-canvas-lite` as direct deps.
- **Why it matters:** the homepage executes WebAssembly downloaded from a public CDN with no SRI. Mitigations exist (pinned version, fallback CDN, graceful CSS fallback on load error). The `.riv` asset is self-hosted; the WASM is CDN-loaded, likely to stay under the 700 KB budget.
- **Fix (optional):** self-host `rive.wasm` from `/assets`, point `setWasmUrl` at same-origin, and drop unpkg/jsdelivr from CSP. Re-measure against the 700 KB budget. Also confirm the two Rive packages don't ship duplicate runtime glue in the bundle.

### 8. Log redaction is by convention, with no regression test (LOW/MED, defense-in-depth)
- **Where:** `poker_project/logging.py:9-21` — `JsonFormatter` emits `message` (`record.getMessage()`) and `exception` (traceback) with **no** scrubbing of `Bearer …` / `Authorization` / token-shaped strings. It is safe today only because callers are disciplined (`_audit` logs action/session_id/membership.pk; auth errors use static messages). No `assertLogs`-based test guards §11.
- **Why it matters:** a future `logger.exception(f"... {token}")` or a logged `request.META` would leak in full with zero redaction. §11 states this is redacted; it's really "never passed to a logger."
- **Fix:** add regex scrubbing of `Bearer\s+\S+` and `HTTP_AUTHORIZATION`-shaped keys in `JsonFormatter.format()`, plus a test asserting a known token never appears in captured log output.

### 9. Reduced-motion: mascot success/error triggers fire on the paused instance (LOW)
- **Where:** `TeddyMascot.jsx:70-80` fires `successTrigger?.fire()`/`failTrigger?.fire()` without checking `prefersReducedMotionRef.current`, even though 82-98 calls `rive.pause()` under reduced motion (and `followPointer` correctly checks the ref).
- **Why it matters:** firing a trigger on a paused state machine can queue a pose that snaps when playback resumes — a small motion a reduced-motion user didn't opt into. No crash.
- **Fix:** guard the signal effect with `prefersReducedMotionRef.current`, mirroring `followPointer`.

### 10. Minor / latent
- **`newerSession` string compare (LOW/NIT):** `RoomPage.jsx:30-38` compares ISO `updated_at` lexicographically. Works because DRF emits a consistent format; fragile if that ever changes. Fix: compare `Date.parse(updated_at)` numerically. (Round-number-first ordering is otherwise robust against stale/out-of-order polls.)
- **Overlapping polls on rapid tab toggling (NIT):** `RoomPage.jsx:344-349` starts a new poll without aborting the in-flight one; `newerSession` dedups so no corruption — only a redundant request. Fix: abort `controller` before the refresh poll.
- **Migration 0009 irreversibility (LOW, doc):** `migrations/0009_production_readiness.py` uses `RunPython(..., RunPython.noop)` and narrows `session_id` 50→20 with no data guard. Safe because the databases started empty (§19), but a footgun if copied for a real-data migration. Document it as intentionally one-way.
- **Untested paths (LOW):** removed-member using an old token on a *mutation* (only the read path is tested), expired-session on mutations (only read/join tested), and `join`/`anon`/`user` throttles (only `create` throttle tested). Add the mutation-path assertions.

### What's solid (do not "fix")
Capability auth model (signed nonce + sha256 digest in DB, constant-time compare, revocable on removal, rotates on rejoin); vote privacy on the API path (`can_view_value` hides others' values, exposes only `has_voted`); atomic reveal/reset/vote with row locks; fail-closed settings (missing `SECRET_KEY`/`ALLOWED_HOSTS`/`DATABASE_URL` raise); strong CSP + security headers; `sessionStorage` token storage keyed by canonical id; route-level code-splitting; reduced-motion honored (CSS collapse + WelcomeIntro bypass), hover gated behind `(hover: hover) and (pointer: fine)`, animations limited to transform/opacity, `:focus-visible` + skip link; CI enforces the 300 KB/700 KB budget, migration-drift check, Postgres-backed tests, and high/critical dependency audits. The **polling-over-websockets** choice is correct for Hobby and should stay.
