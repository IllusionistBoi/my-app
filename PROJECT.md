# Planning Poker project record

This file records the product, architecture, visual system, major implementation decisions, and release verification for the current application.

## Product

Planning Poker is a short-lived, account-free estimation room. Participants choose cards privately, the host reveals only when everyone active is ready, and the room can immediately start another round.

Fixed addresses:

- Production frontend: <https://planning-poker-ronit.vercel.app>
- Compatibility frontend alias: <https://my-app-tau-seven-25.vercel.app>
- Preview frontend: <https://planning-poker-preview-ronit.vercel.app>
- Production API: <https://planning-poker-api-ronit.vercel.app>
- Preview API: <https://planning-poker-api-preview-ronit.vercel.app>

The generated Vercel deployment URLs are immutable diagnostics. The fixed production alias above is the public URL and remains unchanged between deployments. The API is intentionally deployed as a separate Vercel project; its root identifies the service and links back to the browser application.

## Architecture

| Layer | Technology | Hosting |
| --- | --- | --- |
| Frontend | React 19, React Router 7, Vite 8 | Vercel Hobby |
| Animation | Rive canvas-lite runtime, CSS transform/opacity motion | Frontend plus pinned free WASM CDN |
| Backend | Django 5.2 LTS, Django REST Framework | Vercel Hobby Python |
| Database | PostgreSQL | Neon Free |
| CI and monitoring | GitHub Actions | Public-repository free runners |

Production and preview use separate databases and separate secrets. The browser stores a signed participant capability in per-room `sessionStorage`; capabilities never appear in invite links.

## 2026 visual redesign

The redesign replaced the generic light interface with a warm-black, orange-led system inspired by Ronit Dahiya’s portfolio while retaining the application’s security and accessibility behavior.

### Visual language

- Background: warm off-black `#0d0b09`, never pure black.
- Accent: one portfolio-derived orange family centred on `#f56a20`.
- Display typography: locally hosted Clash Display 600/700.
- Interface typography: locally hosted Geist variable and Geist Mono.
- Surfaces: warm charcoal with restrained inner highlights and brown-tinted physical shadows.
- Composition: asymmetric split hero, aligned create/join forms, line-separated explanation and a deliberately sparse footer.
- Brand voice: concise, quirky and clear. Humour never replaces the actionable part of an error.

All fonts are self-hosted from Ronit’s portfolio repository. There are no font-CDN requests and no paid assets.

### Original Rive teddy

The original teddy was recovered from pre-cleanup Git object `57cf108430f4f9001774df8bb29bf29ccba16a3e`:

- Original path: `src/animated_login_character.riv`
- Current path: `frontend/src/assets/poker-teddy.riv`
- State machine: `Login Machine`
- Inputs used: `isChecking`, `isHandsUp`, `numLook`, `trigSuccess`, `trigFail`

`TeddyMascot.jsx` isolates the Rive runtime. The teddy follows horizontal mouse movement and responds to success/failure signals, but deliberately ignores form focus and typing because the inputs sit below the fold. Every five seconds the homepage briefly raises the teddy's paws and rotates through six privacy quips without repeating the previous line. The paws begin lowering before the message clears so copy and physical motion remain synchronized. Pointer updates bypass React rendering. The periodic beat and pointer tracking stop under `prefers-reduced-motion`; a small CSS teddy remains available if the Rive file cannot load.

The canvas-lite runtime was chosen because this legacy vector file does not use Rive Text or other advanced renderer-only features. The `.riv` file is approximately 35 KB.

The matching 2.38.4 WASM runtime is pinned to `unpkg.com` with an exact-version `cdn.jsdelivr.net` fallback. Both hosts are explicitly scoped in `connect-src`; JavaScript still loads only from the application itself. The CSP grants the narrow `'wasm-unsafe-eval'` capability required to compile the downloaded WebAssembly without permitting general `'unsafe-eval'`. This avoids adding roughly 819 KB to the Vercel build while retaining a deterministic runtime version.

### Motion system

- UI press feedback uses a fast `scale(0.97)` response.
- Hover motion is enabled only for fine pointers.
- Page and card entrances animate only `transform` and `opacity`.
- Direct homepage loads use a five-second, timestamp-driven welcome with six poker-specific phrases, a live percentage, a quick Skip control and a split-panel exit.
- Invite/deep-link room loads bypass the welcome entirely; reduced-motion users do too.
- Vote cards deal in with a short 45 ms stagger.
- Live status breathes subtly.
- The ticker uses constant linear motion because it is purely decorative.
- Reveal is the rare celebratory moment: small cards burst across the top edge without obscuring results or commentary.
- Dynamic states use transitions where interruption matters.
- `prefers-reduced-motion` removes perpetual movement, transform choreography and reveal particles while preserving readable state changes.

### Functional copy additions

- Invalid codes explain the required format with a playful line.
- Network, timeout, rate-limit, conflict and server errors have distinct friendly messages.
- Successful vote, clear, spectator, copy, reveal and reset actions have short contextual responses.
- Revealed rounds describe consensus, a small spread or a large spread and prompt the right discussion.
- 404, expired-room and loading states use the same product voice.

### Components added

- `TeddyMascot.jsx` — isolated Rive state-machine integration and fallback.
- `WelcomeIntro.jsx` — isolated homepage-only welcome timing, progress, skip, failsafe and reduced-motion behavior.
- `RevealBurst.jsx` — one-shot, presentation-only reveal celebration.
- `SiteFooter.jsx` — portfolio/source links and project signature.
- `uiCopy.js` — shared friendly error mapping.
- `riveRuntimeStub.js` — deterministic unit-test substitute for the browser animation runtime.

### Screenshot-led correction

The 6 July 2026 correction was driven by full-page home, room, ready, focused and revealed screenshots:

- Reduced negative tracking and display sizes; added explicit word spacing to multi-word display text.
- Switched operational headings to Geist with lighter weights.
- Aligned the create and join panels, fields and actions to one grid.
- Rebuilt the ticker from two identical groups so the loop has no empty interval.
- Removed Rive provenance from the product surface; provenance remains in this document.
- Removed the reveal placard and kept a short, non-obscuring particle flourish.
- Moved connection status beside round metadata and contained participant actions inside each row.
- Reduced section/footer whitespace and made the skip link appear immediately for keyboard focus.

### Welcome and mascot correction

The follow-up on 6 July 2026 removed the clipped “Move. Type. Watch me react.” footer label and the illogical form-driven teddy reactions. The visible speech bubble now explains cursor following. The portfolio's timestamp-driven intro architecture was adapted into original Planning Poker copy rather than copied literally: “Hello.” leads through a short table-preparation sequence, reaches `100%` when the closing phrase lands, then two panels reveal the app. The complete sequence is approximately five seconds including its exit and always offers an immediate Skip control.

### Development and performance

- `DEV_API_PROXY_TARGET` lets local Vite proxy `/api` to the isolated preview backend for production-like browser review without exposing the value in client JavaScript.
- Production still uses same-origin `/api`; preview still uses its fixed isolated API.
- The largest JavaScript chunk remains capped at 300 KB.
- The total build budget is 700 KB to account for the intentionally restored Rive file and self-hosted fonts. The redesign build remains below that ceiling.

## Verification record

Local verification completed on 5 July 2026:

- Node 24 unit tests: 11/11 passed, including a regression check for the least-permissive Rive CSP.
- Production build: 617,287 bytes total; largest JavaScript chunk 237,126 bytes.
- Dependency audit: zero known npm vulnerabilities.
- Two-context Playwright: 3/3 passed, including create, join, hidden votes, reveal, reset and test-room cleanup.
- Responsive/motion Playwright: 320 px no-overflow and reduced-motion checks passed.
- Backend regression: 23 tests passed with one expected PostgreSQL-only local skip; migration drift and system checks passed.
- Manual browser review: desktop and 320 px home, forms, footer, room, selected card, reveal burst and settled results inspected; application console clean.

Remote release completed on 5 July 2026:

- GitHub CI passed all five jobs for application release `1aefcc1776b80d9eed9b4d2eb051b86574dbeeb8`, including dependency audits, repository hygiene, backend checks and multi-browser E2E.
- Both Git-backed Vercel projects reached `READY` for that SHA with their fixed production aliases and no alias errors.
- The fixed frontend returned HTTP 200; same-origin API readiness returned `ready`; the API version reported the release SHA.
- The live production Playwright suite passed 3/3 after deployment, including the Rive runtime, two-participant room flow, 320 px layout, reduced motion, clean console and room cleanup.
- The production CSP permits `'wasm-unsafe-eval'` but not general `'unsafe-eval'`.
- Runtime-error scans were empty for both Vercel projects.
- The manually triggered free uptime workflow passed for the release SHA.

Local screenshot-correction verification completed on 6 July 2026:

- Node 24 unit tests: 13/13 passed, including teddy pointer tracking, both stable production aliases and the Rive CSP.
- Production build: 618,206 bytes total; largest JavaScript chunk 237,189 bytes.
- Playwright: 4/4 passed against the isolated preview backend, including two contexts, reveal/reset/cleanup, 320 px overflow, aligned desktop entry panels, seamless ticker and reduced motion.
- Backend: 24 tests passed with one expected PostgreSQL-only local skip; migration drift and Django deployment checks passed.
- Manual browser review: desktop and 320 px home, aligned forms, populated room, selected vote, ready room, non-obscuring reveal and compact footer inspected.

Production screenshot-correction release completed on 6 July 2026:

- Application commit `30cb70a4eeb939ba17494848a77dd66f12f04846` passed all five GitHub CI jobs and reached `READY` on both Vercel projects.
- The free primary alias `planning-poker-ronit.vercel.app` was attached to the frontend; `my-app-tau-seven-25.vercel.app` remains available for compatibility.
- The new primary alias, its same-origin readiness route, the compatibility alias, the direct API landing route and the API readiness route all returned HTTP 200.
- Live Playwright passed 4/4 against the new primary alias, including the complete two-participant workflow and disposable-room cleanup.
- The direct API root now describes the backend and links visitors to the browser application instead of returning 404.
- The manually triggered free uptime workflow passed, and both Vercel projects reported no runtime errors.

Local welcome-and-mascot verification completed on 6 July 2026:

- Node 24 unit tests: 18/18 passed across six files, including intro timing, percentage, Skip, reduced motion, cursor tracking, hands-up state and rotating privacy copy.
- Production build: 623,958 bytes total; largest JavaScript chunk 239,926 bytes, below both enforced budgets.
- Playwright: 5/5 passed against the isolated backend, including the complete two-participant workflow, direct-room intro bypass, the full homepage welcome, 320 px no-overflow, aligned desktop composition and reduced motion.
- Manual browser review: intro start/final/handoff, actual Rive hands-over-eyes pose, synchronized return copy, desktop hero, 320 px intro and mobile teddy panel inspected with no console warnings or errors.

Production welcome-and-mascot release completed on 6 July 2026:

- Application commit `daa20e4549f23b4006e69fcc69a789a599c8543b` passed all five GitHub CI jobs and reached `READY` on both Vercel projects.
- `planning-poker-ronit.vercel.app` resolved to that exact deployment, returned HTTP 200 and reported the matching API release SHA.
- Live Playwright passed 5/5, including the full welcome, direct-room bypass, two-participant room lifecycle, 320 px layout and reduced motion.
- The manually triggered free uptime workflow passed, and both Vercel projects reported no runtime-error clusters.

Detailed security, backend, deployment, recovery and free-plan operations remain canonical in `CLAUDE.md`. The full audit and implementation chronology live in `tasks/todo.md`.
