# Current Task: Full-stack production readiness

## Audit evidence

- Frontend tests: 2 suites / 5 tests pass, with outdated Testing Library and React Router warnings.
- Backend tests: 0 / 2 pass; both crash because the `vote_results` model field has no migration.
- `manage.py check --deploy`: 6 security warnings.
- Frontend dependency audit: 51 advisories (1 critical, 21 high, 19 moderate, 10 low).
- Backend dependency audit: unsupported Django 5.1.1 plus known-vulnerable transitive/runtime packages.
- Live browser: desktop renders, but 375px mobile width overflows to 467px and clips the form/actions.
- Live browser console: production requests `/src/index.js` and receives HTML, causing `Unexpected token '<'`.
- Live backend: serves Django debug pages and does not match the current local backend source.
- Git/Vercel: production was deployed from a dirty local tree; `origin/master` does not contain `frontend/` or `backend/`.

## Complete findings register

Severity:

- **P0** — active security/data/release blocker; do not ship the current backend.
- **P1** — high-impact correctness, durability, or operational risk.
- **P2** — important reliability, accessibility, performance, and maintainability work.
- **P3** — cleanup and quality debt.

### P0 — release blockers

1. **Username-only JWT issuance enables complete identity impersonation.**
   - Evidence: `backend/poker_project/session_management/views.py:get_token` is public and returns tokens for any supplied username.
   - Impact: anyone can mint a creator token.
   - Fix: remove username-as-authentication; issue unguessable session-scoped capabilities atomically from create/join.
   - Verify: an existing creator name cannot be reclaimed without its capability.

2. **Every protected endpoint lacks object-level authorization.**
   - Evidence: mutations trust `username` in request bodies; reveal/reset/remove have no host check; reads have no membership check.
   - Impact: token holders can alter other votes, reveal/reset, remove users, read rooms, or delete sessions.
   - Fix: bind identity to the signed session capability; self-only vote/status actions, host-only administration, member-only reads.
   - Verify: complete endpoint permission matrix returns 401/403 for non-members and non-hosts.

3. **Production signing key is committed and production runs with `DEBUG=True`.**
   - Evidence: `backend/poker_project/poker_project/settings.py:23,26`; live Render 404 exposes the debug URL table.
   - Impact: signed values/tokens are forgeable and errors leak internals.
   - Fix: require `DJANGO_SECRET_KEY` in production, rotate the exposed key/tokens, default debug off, fail closed without secrets.
   - Verify: old-key capabilities fail and production emits generic 404/500 pages.

4. **Current model state cannot be recreated from migrations.**
   - Evidence: `Session.vote_results` has no `0009` migration; `makemigrations --check` fails.
   - Impact: clean deploys and tests crash with `no column named vote_results`.
   - Fix: add reviewed forward/data migrations and gate deploys on migration consistency.
   - Verify: migrate empty DB and an existing `0008` DB; run all tests.

5. **The live backend is an older, unaudited revision.**
   - Evidence: live API has no token route and allows unauthenticated details; local source expects the opposite.
   - Impact: production behavior is irreproducible and code fixes may not deploy.
   - Fix: commit the new repository layout, define Render root/build/start commands in code, expose deployment SHA.
   - Verify: `/health/` reports the intended commit and live contract tests match source.

6. **Production data uses SQLite on an ephemeral Render filesystem.**
   - Evidence: settings hard-code `db.sqlite3`; the public Git history contains a database with production-like users/sessions, a superuser, an email value, a usable password hash, and Django sessions.
   - Impact: treat participant/session data, admin credentials, sessions, and the signing key as compromised; redeploys can also lose new data.
   - Fix: preserve/export intended data, reset privileged credentials, move to managed PostgreSQL with backups, remove the database from Git, and rewrite history.
   - Verify: secret/history scan clean, old credentials/tokens fail, restore drill passes, data survives redeploy, no tracked database files.

7. **Git-backed deployment is currently broken.**
   - Evidence: `origin/master` contains the old root layout; current `frontend/` and `backend/` are untracked while old files are deleted.
   - Impact: the next Git push/redeploy can fail or overwrite the working production artifact.
   - Fix: create a clean production-readiness branch/commit containing the intended monorepo layout and deployment configuration.
   - Verify: clean clone can install, test, build, and deploy without local-only files.

### P1 — high priority

8. **Unrevealed votes are disclosed to every participant.**
   - Evidence: details/votes endpoints return the raw vote JSON before reveal.
   - Fix: return only `has_voted` and spectator state for others; expose values only to the voter or after reveal.

9. **Reveal readiness is logically wrong.**
   - Evidence: join creates a vote key with `vote=None`; reveal checks key presence instead of a non-null eligible vote.
   - Fix: require every non-spectator member to hold a valid vote; spectators do not block reveal.

10. **Round state is not authoritative.**
    - Evidence: revealed results remain after reset/change/removal; clients cannot reliably observe remote reveal/reset; voting stays enabled after reveal.
    - Fix: add server-side `round_number` and `is_revealed`; reset atomically clears results and advances the round; revealed rounds reject votes.

11. **Concurrent JSON read-modify-write can lose votes.**
    - Evidence: all vote mutations edit one JSON field without transactions or row locks.
    - Fix: on PostgreSQL, wrap state transitions in `transaction.atomic()` and `select_for_update()`; retain a future path to normalized Vote rows if scale grows.
    - Verify: simultaneous vote tests preserve both writes.

12. **Removed users and non-members can continue acting.**
    - Evidence: backend does not check membership and frontend leaves controls active after removal.
    - Fix: every action validates membership; removal immediately revokes the capability through membership checks; client exits the room on 403.

13. **Create/join and authentication are non-atomic.**
    - Evidence: frontend creates a session, then separately requests a token; auth failure reports creation failure and retries can orphan rooms.
    - Fix: create/join return the session-scoped capability in the same response and support idempotent submissions.

14. **JWT expiry breaks active sessions.**
    - Evidence: refresh token is stored but never used; first 401 deletes all tokens.
    - Fix: replace the unnecessary global JWT flow with revocable, session-scoped signed capabilities and a documented lifetime.

15. **Deep links do not establish session-scoped identity.**
    - Evidence: room route falls back to one global username or an empty string.
    - Fix: store credentials per session ID; redirect credentialless room links into a prefilled join flow.

16. **Input validation is bypassed and serializers are unused.**
    - Evidence: arbitrary vote integers pass; JSON `"false"` becomes true; lengths/casing differ across endpoints.
    - Fix: action-specific serializers, shared normalization, card enum validation, strict booleans, length limits, stable error codes.

17. **Anonymous endpoints have no throttling or quotas.**
    - Evidence: create/join/token are public with no DRF throttles.
    - Fix: scoped anonymous/user throttles, session limits, expiry/cleanup, and 429 tests.

18. **Session IDs are generated with non-cryptographic randomness and collisions become 500s.**
    - Fix: use `secrets`, canonicalize IDs, and retry unique collisions around the DB constraint.

19. **Session lifecycle is unbounded.**
    - Evidence: no expiry, status, archive, cleanup, or updated timestamp.
    - Fix: add expiry/update metadata, reject expired sessions, and provide a cleanup command/cron policy.

20. **Backend dependency/runtime baseline is unsupported and vulnerable.**
    - Evidence: Django 5.1.1 is unsupported; audits flag Django/PyJWT/ecdsa/sqlparse; local Python 3.14 is unsupported by Django 5.1.
    - Fix: Django 5.2 LTS latest patch, supported pinned Python, current DRF/Gunicorn/database packages, minimal runtime requirements, automated audit.

21. **Frontend uses deprecated Create React App with a critical/high audit surface.**
    - Evidence: `react-scripts@5`; 51 advisories; React officially deprecated CRA.
    - Fix: migrate to Vite/Vitest, update Router/testing/Rive packages, remove unused packages, separate runtime/dev dependencies.

22. **No CI/CD gate exists.**
    - Evidence: no workflow runs tests, audits, migration checks, production builds, or deploy verification.
    - Fix: GitHub Actions for frontend/backend tests, migration drift, dependency audit, build, and preview smoke tests.

23. **Backend deployment is dashboard-only and undocumented.**
    - Evidence: no Render blueprint/container/runtime file; README Gunicorn module is wrong; Gunicorn is installed from a Git SHA.
    - Fix: define runtime, build, migration, start, health check, env vars, database, and rollback in source.

24. **Mobile layout is unusable.**
    - Evidence: live 375px viewport scrolls to 467px; input begins at x=-86; first action begins at x=-71; Rive is fixed 500×500.
    - Fix: fluid canvas/form/card sizes, responsive grids/navigation, safe-area spacing, 320/375/768px tests.

25. **Core actions can execute repeatedly or out of order.**
    - Evidence: no pending state on create/join/vote/spectator/admin controls.
    - Fix: per-action pending state, double-submit prevention, serialized vote writes, and server round/version checks.

26. **Production frontend is tightly coupled to one hard-coded external backend.**
    - Evidence: `frontend/vercel.json` proxies directly to the production Render hostname for production, preview, and development deployments.
    - Impact: Vercel previews can mutate production data and there is no readiness/version contract.
    - Fix: environment-managed origins with a separate staging backend/database, health/version checks, request timeouts, and staged cutover.

### P2 — important hardening

27. **Polling overlaps and stale responses can win.**
    - Fix: completion-based polling with abort/version guards and visibility-aware backoff; consider SSE/WebSockets later.

28. **API requests have no timeout, cancellation, correlation, or safe retry policy.**
    - Fix: centralized request client with AbortController, typed errors, request IDs, and idempotency-aware retries.

29. **API base configuration can become `undefined/...`.**
    - Fix: same-origin `/api` default, validated environment override, `.env.example`, corrected tests.

30. **Initial/loading/fatal/404/removed states are missing.**
    - Fix: explicit route and room state machine, error boundary, not-found route, disabled controls until ready.

31. **Errors are generic, inaccurate, and can remain after recovery.**
    - Fix: typed error mapping for 401/403/404/409/429/5xx/offline; clear on recovery; notification IDs/queue.

32. **Spectator transition is a redundant, non-atomic double request.**
    - Fix: one server mutation returning authoritative state.

33. **Destructive controls lack confirmation and creator self-removal is offered.**
    - Fix: hide invalid actions; accessible confirmations; one pending destructive request at a time.

34. **Vote cards are not keyboard-accessible.**
    - Evidence: clickable `<div>` without role/focus/keyboard/pressed state.
    - Fix: native buttons with `aria-pressed`, disabled state, visible focus, and descriptions.

35. **Spectator switch and notifications are inaccessible.**
    - Fix: accessible switch name, visible focus, `role=status`/`role=alert`, screen-reader verification.

36. **Informational text is exposed as fake buttons.**
    - Fix: replace `BrokenTextButton` usages with semantic status/text elements.

37. **Homepage form semantics are incomplete.**
    - Evidence: Enter does not submit; no max lengths/autocomplete/pending behavior.
    - Fix: real submit flow, shared client/server constraints, keyboard tests.

38. **Reduced-motion preferences are ignored.**
    - Fix: disable nonessential animation/confetti and pause background work under `prefers-reduced-motion`.

39. **Rive can dereference a missing state-machine input and is fixed-size.**
    - Fix: null guards, fallback UI, correct React style properties, responsive sizing.

40. **Tailwind directives/utilities are present but Tailwind is not configured.**
    - Fix: remove Tailwind and replace the small utility usage with scoped CSS.

41. **Avatar selection breaks for participant 8 and shifts after removal.**
    - Fix: stable hash of participant identity modulo the seven actual icons; stable React keys.

42. **Clipboard reports success before copying succeeds.**
    - Fix: await/catch clipboard, provide fallback, copy the full join URL.

43. **Production metadata is generic and emits a console syntax error.**
    - Evidence: title/manifest say “React App”; built HTML requests `/src/index.js`.
    - Fix: real metadata/manifest and remove the manual source script.

44. **Frontend lacks defense-in-depth headers.**
    - Evidence: live root has HSTS only; no CSP, permissions policy, referrer policy, frame policy, or private-route noindex.
    - Fix: Vercel headers with a tested CSP, permissions/referrer/frame/content policies, API no-store, session-route noindex.

45. **Large unused assets bloat deployment.**
    - Evidence: build is ~33 MB; unused vote PNGs plus `homepagev2.png` account for ~28 MB.
    - Fix: delete/archive unused assets, optimize retained images, add a bundle/deploy size budget.

46. **Backend transport/security settings are incomplete.**
    - Evidence: deployment check flags HSTS, HTTPS redirect, secure cookies; duplicate CommonMiddleware; no proxy SSL setting.
    - Fix: trusted proxy SSL header, staged HSTS, HTTPS/cookie settings, strict host parsing, remove duplicate middleware.

47. **Membership has two sources of truth.**
    - Evidence: M2M participants and unused `UserSession`.
    - Fix: remove unused model or make one membership source authoritative.

48. **Two authentication systems coexist without revocation.**
    - Evidence: custom no-password JWT plus standard obtain/refresh routes; no blacklist/rotation.
    - Fix: one session-capability design; remove unused JWT routes/dependencies.

49. **No health/readiness/version endpoint, structured logging, audit events, or error monitoring.**
    - Fix: `/health/`, `/ready/`, commit SHA, JSON stdout logs, request IDs, privileged-action logs, privacy-filtered error monitoring.

50. **CORS configuration is stale.**
    - Fix: keep same-origin proxy and remove unnecessary public CORS, or use exact environment-driven origins—do not mix both.

51. **Admin/static production behavior is unverified.**
    - Fix: WhiteNoise or explicit static hosting, collected-static test, secure/limit admin access.

52. **API contract is ad hoc.**
    - Evidence: action URLs, DELETE body, mixed `error`/`detail`, no version/schema.
    - Fix: versioned stable envelope, serializers, no identity in bodies, OpenAPI/contract tests.

53. **Frontend and backend test coverage misses most real workflows.**
    - Fix: permission matrix, state-machine, concurrency, migration, PostgreSQL, component interaction, accessibility, responsive, and two-browser E2E tests.

54. **Frontend production observability is absent.**
    - Fix: error boundary/reporting hook, API correlation IDs, release metadata, web-vitals or equivalent telemetry.

55. **Runtime and package-manager inputs are not consistently pinned.**
    - Evidence: Vercel uses Node 24, the machine default is Node 20, Python has no repository runtime pin, and no `packageManager` field exists.
    - Fix: pin Node/npm and Python, use clean lock-driven installs, and document the supported matrix.

56. **Rollback artifacts are not trustworthy.**
    - Evidence: Vercel rollback candidates were produced from dirty trees tied to the same misleading old Git SHA; no backend/database rollback exists.
    - Fix: immutable clean artifacts, expand/contract migrations, tested Vercel promotion/rollback, Render rollback, and database restore runbook.

### P3 — cleanup and quality

57. **Timers are not centrally cleaned up; success animation does not reset reliably.**
58. **CSS contains invalid declarations, duplicate keyframes, mojibake, and global selector leakage.**
59. **Background path `/public/f.jpg` is invalid in production; `/f.jpg` is the real asset.**
60. **Unused frontend packages and duplicate Rive packages increase install/bundle risk.**
61. **Production requirements mix runtime and lint/development packages.**
62. **Requirements use an unversioned deployment strategy and a Git-pinned Gunicorn build.**
63. **Documentation is stale and contradictory about paths, PostgreSQL, auth, endpoints, and deployment.**
64. **`.gitignore` covers only `.vercel`; env files, virtualenvs, bytecode, databases, builds, logs, and coverage are exposed.**
65. **README examples are malformed or use placeholder repositories/obsolete paths.**
66. **No explicit dependency-update, backup, incident-response, or rollback runbook exists.**
67. **No LICENSE, SBOM, attribution record, or automated license policy exists.**
68. **Only platform-generated domains are configured; an owned production domain would improve continuity and branding.**

## Ordered implementation plan

### Phase 0 — contain and make the repository reproducible

- [x] Confirm the deployed app has no real users or data-retention requirement; start the new production database empty.
- [ ] Rotate the exposed Django signing key and invalidate old tokens when the backend cutover occurs.
- [x] Replace `.gitignore`; remove generated/database artifacts from tracking without deleting the user’s local DB.
- [x] Establish the intended `frontend/` + `backend/` layout and remove obsolete root artifacts.
- [x] Add environment examples and pin Node/Python/runtime expectations.

### Phase 1 — make the backend deployable

- [x] Upgrade to supported Django 5.2 LTS and minimal current production dependencies.
- [x] Add missing and production-readiness migrations.
- [x] Configure environment-driven secret/debug/hosts/database/security/static/logging settings.
- [x] Add PostgreSQL `DATABASE_URL` support and retain SQLite only as an explicit local-development fallback.
- [x] Add health/readiness/version endpoints and Vercel Django deployment-as-code.

### Phase 2 — secure identity, permissions, and room state

- [x] Replace username JWT minting with signed, unguessable, session-scoped participant capabilities returned by create/join.
- [x] Store capabilities per session in the frontend and remove global JWT/refresh behavior.
- [x] Enforce member/self/host authorization for every endpoint.
- [x] Add serializer-based validation, throttling, cryptographic session IDs, expiry, and cleanup.
- [x] Add authoritative round/reveal state, hide unrevealed votes, reject post-reveal voting, and clear results on reset.
- [x] Wrap JSON state transitions in PostgreSQL row locks/transactions and add concurrency tests.

### Phase 3 — modernize and harden the frontend

- [x] Migrate CRA/Jest to Vite/Vitest and remove unused/vulnerable packages.
- [x] Build a centralized timeout-aware API client and session credential store.
- [x] Add join-from-deep-link, loading/error/removed/not-found states, request pending locks, and destructive confirmations.
- [x] Make polling abortable, version-aware, and visibility-aware.
- [x] Repair reveal/reset/spectator synchronization and use server-authoritative responses.

### Phase 4 — accessibility, responsive UI, and performance

- [x] Replace clickable divs/fake buttons with semantic controls and live regions.
- [x] Remove the obsolete Rive layer and make forms, cards, navigation, and results responsive down to 320px and at 200% zoom.
- [x] Add visible focus, reduced-motion behavior, keyboard flow, and accessible labels.
- [x] Fix CSS/path/metadata/manifest/console issues.
- [x] Remove unused ~28 MB assets and set size budgets.
- [x] Add CSP and other Vercel security/cache/indexing headers.

### Phase 5 — quality gates, documentation, and operations

- [x] Expand backend tests for auth, authorization, privacy, state, validation, throttling, migrations, and concurrency.
- [x] Expand frontend tests for workflows, errors, capability storage, and API contracts; manually verify semantic/responsive behavior.
- [x] Add two-browser E2E coverage and GitHub Actions gates.
- [x] Create `CLAUDE.md` with architecture, workflows, commands, environment variables, conventions, deployment, verification, and known operational constraints.
- [x] Rewrite README/run/deployment docs to match reality.
- [x] Run clean installs, audits, tests, migration checks, production builds, and local full-stack smoke tests.

### Phase 6 — free-only production cutover

- [x] Confirm the existing `my-app-tau-seven-25.vercel.app` production alias is fixed across deployments and included on Vercel Hobby.
- [x] Select an all-free architecture: Vite on the existing Vercel project, Django on a second Vercel Hobby project, and Neon Free Postgres.
- [x] Remove the paid Render Blueprint path and add zero-configuration Vercel/Django deployment settings.
- [x] Create and link the backend Vercel project without upgrading the account or enabling paid usage.
- [x] Provision separate Neon Free production and preview databases with no credit card, configure backend secrets, and migrate empty schemas.
- [x] Deploy Django, then verify health/readiness/version, authorization, hidden votes, persistence, security headers, and runtime logs.
- [x] Point the frontend same-origin `/api` proxy and CSP at the new backend, deploy a preview, and run live full-stack smoke tests.
- [x] Deploy the tested frontend to production and verify the fixed production alias, two-browser workflow, responsive layout, console, and rollback path.
- [x] Create a clean root commit, force-push the replacement `master` history, and delete the obsolete remote feature branch containing another database copy.
- [x] Connect both Vercel projects to the clean GitHub repository with roots `frontend` and `backend/poker_project`.
- [x] Update all documentation to describe the free Vercel + Neon architecture, stable domain, quotas, and recovery steps.
- [x] Add a free six-hour GitHub Actions uptime/readiness check; do not enable a paid custom domain, monitoring add-on, database plan, or Vercel plan.

### Phase 7 — final platform verification

- [x] Upgrade GitHub Actions to Node 24-compatible major versions and validate the workflow YAML.
- [x] Push the final commit and confirm every CI job passes without deprecated-runtime warnings.
- [x] Confirm both Vercel projects deploy the final Git commit to their fixed production aliases.
- [x] Re-run fixed-domain readiness checks and leave the repository clean.

### Phase 8 — signature visual redesign

- [x] Audit the current home, room, reveal, empty, loading, error, mobile, and footer states against the supplied screenshots and portfolio visual language.
- [x] Restore the original authored teddy Rive asset and integrate its `Login Machine` inputs in an isolated, responsive component with a non-blocking fallback.
- [x] Replace the generic light UI with a cohesive warm-black/orange visual system, characterful typography, asymmetric composition, and a complete responsive footer.
- [x] Add purposeful motion: staged page entrances, tactile card/button feedback, live status motion, and a one-shot reduced-motion-safe reveal celebration.
- [x] Rewrite system feedback with clear but quirky messages and add useful revealed-round commentary without weakening error meaning or accessibility.
- [x] Extend unit/E2E coverage for the redesigned flows, Rive fallback, responsive layout, reduced motion, and clean browser console.
- [x] Create `PROJECT.md`; update `README.md`, `CLAUDE.md`, and the implementation log with the design system, asset provenance, motion rules, and verification evidence.
- [x] Run clean tests, audits, production build/size checks, local full-stack browser review, and mobile/desktop visual inspection.
- [ ] Commit and push the redesign, verify GitHub CI and both Vercel deployments, smoke-test the fixed production URL, and scan runtime errors.

## Definition of done

- No P0 findings remain in code or deployment configuration.
- Backend tests and frontend tests pass from a clean clone.
- Migration drift check passes; clean and upgrade migrations work.
- Django deployment check is clean under production settings.
- No high/critical production dependency findings remain without an explicit documented exception.
- Creator/participant permission and hidden-vote tests pass.
- Concurrent votes survive on PostgreSQL.
- 320px/375px/768px and keyboard/accessibility checks pass without horizontal overflow.
- Production browser console is clean.
- Health/version endpoint reports the deployed commit.
- Deployment is reproducible from Git, not a dirty local tree.
- Live database is backed up and the backend cutover has a tested rollback.

## Implementation log

_No application behavior changes started before completion of this findings register._

- 2026-07-04: Added repository hygiene, CI/Dependabot, Render/PostgreSQL deployment-as-code, and the first complete `CLAUDE.md`/operations documentation pass.
- 2026-07-04: Began backend hardening: fail-closed settings, supported dependencies, scoped capability authentication, authoritative round state, migration, health checks, and API authorization.
- 2026-07-05: Backend/frontend implementation workers reached their usage ceiling. Re-planned remaining work sequentially: finish and verify backend, implement frontend against the frozen contract, reconcile deployment/docs, then run end-to-end verification. No unverified deployment will replace the working production site.
- 2026-07-05: Backend now uses signed, nonce-digested room capabilities, member/self/host authorization, hidden votes, authoritative round state, row locks, expiry, cleanup, generic JSON errors, request IDs, no-store responses, health/readiness/version routes, PostgreSQL settings, and a reviewed upgrade migration.
- 2026-07-05: Frontend migrated from CRA to Vite/React 19, removed 51 npm advisories and roughly 29 MB of legacy assets, added per-room `sessionStorage` capabilities, timeout/cancellation, deep-link join, guarded actions, polling reconciliation, responsive semantic UI, CSP, cache/security headers, and route splitting.
- 2026-07-05: Verification passed: clean Node 24 install, 10/10 frontend tests, zero npm advisories, production/Vercel build, clean Python 3.14 install, 23 backend tests passed with one PostgreSQL-only concurrency test delegated to CI, zero Python advisories, clean fresh/upgrade migrations, static collection, and clean Django deployment check.
- 2026-07-05: Browser verification passed for local create → vote → reveal, clean console, route scroll reset, and 320/375px zero-overflow layouts. Vercel project metadata was updated from CRA to Vite and the obsolete environment variable was removed without redeploying.
- 2026-07-05: Added and locally passed a Playwright CI gate using two isolated browser contexts against the real Django API: create, deep-link join, hidden remote vote, reveal, reset/poll synchronization, and 320px overflow.
- 2026-07-05: A final verification command resolved the workstation's global Node 20 instead of the required Node 24 and failed before running tests. Stopped and re-planned verification to pin the bundled Node 24 executable explicitly for clean install, test, build, and audit commands.
- 2026-07-05: Final explicit-runtime verification passed under Node 24.14.0 and Python 3.14.3: fresh npm install, 10/10 unit tests, production build/size budget, 2/2 real full-stack E2E tests, 23 backend tests with the PostgreSQL-only concurrency test reserved for CI, schema drift plus clean/upgrade migration paths, production deploy check, static collection, dependency integrity, and zero known npm/Python vulnerabilities. Generated E2E and migration artifacts were removed.
- 2026-07-05: User confirmed the old deployment has no real users or data-retention requirement. Replaced the paid Render plan with two Vercel Hobby projects and two explicitly selected Neon `free_v3` databases; no card, trial, paid custom domain, or billable add-on was enabled.
- 2026-07-05: Fixed the legacy UUID-to-bigint migration defect exposed by the first real PostgreSQL migration. Clean Neon production and preview schemas now migrate through `0009`.
- 2026-07-05: Deployed and verified fixed free aliases for frontend/backend production and preview. Both live environments passed isolated two-context E2E coverage, hidden-vote/reveal/reset behavior, 320px layout, console/page-error assertions, security headers, cleanup, and runtime-error scans.
- 2026-07-05: Replaced the remote `master` history with clean root commit `68f5cca` and deleted the obsolete `feat/performance-optimizations-websockets` branch, removing all remote branch references to the tracked SQLite copies and exposed key.
- 2026-07-05: Connected frontend project `my-app` to root `frontend` and backend project `planning-poker-api-ronit` to root `backend/poker_project` on the clean GitHub repository.
- 2026-07-05: Added a free six-hour GitHub Actions check for both fixed frontend aliases and both API readiness paths. No third-party monitoring account or paid Vercel feature is used.
- 2026-07-05: Upgraded GitHub Actions to Node 24-compatible majors. Final CI passed all five jobs without deprecated-runtime warnings; both Git-backed Vercel deployments reached `READY`, fixed aliases returned HTTP 200, the production API reported the expected Git SHA, the manual uptime run passed, and both projects had no runtime errors.
- 2026-07-05: Recovered the original `animated_login_character.riv` teddy from pre-cleanup Git history and rebuilt the frontend around a warm-black/orange portfolio-inspired visual system. Added state-driven Rive reactions, locally hosted Clash/Geist fonts, a complete footer, quirky typed feedback, reveal commentary, tactile card motion, a reduced-motion-safe card burst, pinned Rive WASM hosts under CSP, and a preview-backed local review proxy.
- 2026-07-05: Redesign verification passed locally: clean Node 24 install, 10/10 unit tests, 3/3 Playwright flows with two isolated participants, hidden votes, reveal/reset/cleanup, 320px no-overflow and reduced-motion checks; 617,287-byte build under the 700KB total/300KB JS ceilings; zero npm advisories; and 23 backend tests passed with one expected PostgreSQL-only local skip.
- Remaining paid-only options are intentionally declined: purchased custom domain, Vercel monitoring add-ons, and database upgrades.
