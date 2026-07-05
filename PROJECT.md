# Planning Poker project record

This file records the product, architecture, visual system, major implementation decisions, and release verification for the current application.

## Product

Planning Poker is a short-lived, account-free estimation room. Participants choose cards privately, the host reveals only when everyone active is ready, and the room can immediately start another round.

Fixed addresses:

- Production frontend: <https://my-app-tau-seven-25.vercel.app>
- Preview frontend: <https://planning-poker-preview-ronit.vercel.app>
- Production API: <https://planning-poker-api-ronit.vercel.app>
- Preview API: <https://planning-poker-api-preview-ronit.vercel.app>

The generated Vercel deployment URLs are immutable diagnostics. The fixed production alias above is the public URL and remains unchanged between deployments.

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
- Composition: asymmetric split hero, offset create/join forms, line-separated explanation and a deliberately sparse footer.
- Brand voice: concise, quirky and clear. Humour never replaces the actionable part of an error.

All fonts are self-hosted from Ronit’s portfolio repository. There are no font-CDN requests and no paid assets.

### Original Rive teddy

The original teddy was recovered from pre-cleanup Git object `57cf108430f4f9001774df8bb29bf29ccba16a3e`:

- Original path: `src/animated_login_character.riv`
- Current path: `frontend/src/assets/poker-teddy.riv`
- State machine: `Login Machine`
- Inputs used: `isChecking`, `isHandsUp`, `numLook`, `trigSuccess`, `trigFail`

`TeddyMascot.jsx` isolates the Rive runtime. The teddy follows name length, covers its eyes while room details are entered, and responds to success/failure signals. It pauses for `prefers-reduced-motion` and falls back to a small CSS teddy if the Rive file cannot load.

The canvas-lite runtime was chosen because this legacy vector file does not use Rive Text or other advanced renderer-only features. The `.riv` file is approximately 35 KB.

The matching 2.38.4 WASM runtime is pinned to `unpkg.com` with an exact-version `cdn.jsdelivr.net` fallback. Both hosts are explicitly scoped in `connect-src`; JavaScript still loads only from the application itself. The CSP grants the narrow `'wasm-unsafe-eval'` capability required to compile the downloaded WebAssembly without permitting general `'unsafe-eval'`. This avoids adding roughly 819 KB to the Vercel build while retaining a deterministic runtime version.

### Motion system

- UI press feedback uses a fast `scale(0.97)` response.
- Hover motion is enabled only for fine pointers.
- Page and card entrances animate only `transform` and `opacity`.
- Vote cards deal in with a short 45 ms stagger.
- Live status breathes subtly.
- The ticker uses constant linear motion because it is purely decorative.
- Reveal is the rare celebratory moment: cards burst outward and a “Cards up” placard appears once.
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
- `RevealBurst.jsx` — one-shot, presentation-only reveal celebration.
- `SiteFooter.jsx` — portfolio/source links and project signature.
- `uiCopy.js` — shared friendly error mapping.
- `riveRuntimeStub.js` — deterministic unit-test substitute for the browser animation runtime.

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

Detailed security, backend, deployment, recovery and free-plan operations remain canonical in `CLAUDE.md`. The full audit and implementation chronology live in `tasks/todo.md`.
