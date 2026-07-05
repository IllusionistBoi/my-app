# Planning Poker

Planning without the poker face: a playful, short-lived room for private estimates, synchronized reveals, spectators, and repeatable rounds.

The experience uses the project’s original interactive Rive teddy, a portfolio-inspired warm-black/orange visual system, responsive card motion, reveal celebrations, and deliberately quirky feedback without compromising accessibility.

## Live application

- Production: <https://planning-poker-ronit.vercel.app>
- Compatibility alias: <https://my-app-tau-seven-25.vercel.app>
- Preview: <https://planning-poker-preview-ronit.vercel.app>
- Production API: <https://planning-poker-api-ronit.vercel.app>
- Preview API: <https://planning-poker-api-preview-ronit.vercel.app/api/health/>

The production addresses are stable Vercel aliases. New deployments receive unique diagnostic URLs, but promoting a deployment moves the fixed alias instead of changing the public address. The API is a separate Django backend used by the browser application; its root returns a small service-status response rather than the React interface.

## Free-only architecture

- `frontend/` — React 19 + Vite SPA on the existing Vercel Hobby project.
- `backend/poker_project/` — Django 5.2 API on a second Vercel Hobby project.
- Neon Free — separate London PostgreSQL projects for production and preview/development.
- `.github/workflows/ci.yml` — clean installs, tests, builds, migrations, security checks, and audits.
- `CLAUDE.md` — canonical architecture, API, security, deployment, quotas, and recovery handbook.
- `PROJECT.md` — product, visual system, Rive provenance, motion rules, and release record.
- `tasks/todo.md` — complete production-readiness audit and implementation record.

No paid Vercel, Render, database, custom-domain, or monitoring resource is required. Vercel Hobby is for personal/non-commercial use and stops features at free limits rather than creating a Hobby billing cycle. Neon Free requires no card but has capacity and retention limits documented in `CLAUDE.md`.

## Prerequisites

- Node.js 24 and npm.
- Python 3.14.3.
- PostgreSQL for production-equivalent backend work.

SQLite is available only for disposable local development.

## Local development

Backend:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
python -m pip install -r backend/poker_project/requirements.txt
$env:DJANGO_DEBUG="true"
$env:DJANGO_SECRET_KEY="local-only-random-value-at-least-fifty-characters-long"
Set-Location backend/poker_project
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Frontend, in another terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to Django.

To review the frontend against the isolated preview backend without running Django locally:

```powershell
Set-Location frontend
$env:DEV_API_PROXY_TARGET="https://planning-poker-api-preview-ronit.vercel.app"
npm run dev
```

`DEV_API_PROXY_TARGET` is consumed by the Vite development server only. It is not embedded in browser code.

Windows users can run `run-dev.bat` after installing both dependency sets.

## Verification

```powershell
# Frontend
Set-Location frontend
npm ci
npm test
npm run build
npm audit
npm run test:e2e

# Test an already deployed environment
$env:E2E_BASE_URL="https://planning-poker-preview-ronit.vercel.app"
npm run test:e2e

# Backend
Set-Location ../backend/poker_project
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py test
python manage.py collectstatic --noinput
```

CI also runs PostgreSQL concurrency tests, Django deployment checks, Python dependency auditing, full-history secret scanning, and repository-hygiene checks.

## Design and animation

- `frontend/src/assets/poker-teddy.riv` is the original authored teddy recovered from the first version of the project.
- `TeddyMascot.jsx` drives its `Login Machine` state machine from mouse position, form focus, typed names, and success/error signals.
- Clash Display, Geist, and Geist Mono are self-hosted from Ronit’s portfolio assets.
- Reveal celebration, card dealing, tactile controls, mobile layouts, and reduced-motion behavior live in `styles.css`.
- Rive and page routes remain code-split. The build enforces a 300 KB largest-JavaScript limit and a 700 KB total-asset limit.

See `PROJECT.md` for the full design decision and verification record.

## Deployment

| Layer | Vercel project | Root | Fixed production address |
| --- | --- | --- | --- |
| Frontend | `my-app` | `frontend` | `planning-poker-ronit.vercel.app` |
| Backend | `planning-poker-api-ronit` | `backend/poker_project` | `planning-poker-api-ronit.vercel.app` |

Production frontend traffic uses same-origin `/api` rewrites. Preview uses `VITE_API_URL` to reach the fixed preview API and its separate Neon database.

`my-app-tau-seven-25.vercel.app` remains attached as a free compatibility alias. The two Vercel projects are intentional: one serves the React website, while `planning-poker-api-ronit` runs the Django API and connects to PostgreSQL.

See `CLAUDE.md` before changing environment variables, databases, aliases, or deployment protection.
