# Planning Poker

A short-lived planning-poker room for private estimates, host-controlled reveals, spectators, and repeatable rounds.

## Live application

- Production: <https://my-app-tau-seven-25.vercel.app>
- Preview: <https://planning-poker-preview-ronit.vercel.app>
- Production API: <https://planning-poker-api-ronit.vercel.app/api/health/>
- Preview API: <https://planning-poker-api-preview-ronit.vercel.app/api/health/>

The production addresses are stable Vercel aliases. New deployments receive unique diagnostic URLs, but promoting a deployment moves the fixed alias instead of changing the public address.

## Free-only architecture

- `frontend/` — React 19 + Vite SPA on the existing Vercel Hobby project.
- `backend/poker_project/` — Django 5.2 API on a second Vercel Hobby project.
- Neon Free — separate London PostgreSQL projects for production and preview/development.
- `.github/workflows/ci.yml` — clean installs, tests, builds, migrations, security checks, and audits.
- `CLAUDE.md` — canonical architecture, API, security, deployment, quotas, and recovery handbook.
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

## Deployment

| Layer | Vercel project | Root | Fixed production address |
| --- | --- | --- | --- |
| Frontend | `my-app` | `frontend` | `my-app-tau-seven-25.vercel.app` |
| Backend | `planning-poker-api-ronit` | `backend/poker_project` | `planning-poker-api-ronit.vercel.app` |

Production frontend traffic uses same-origin `/api` rewrites. Preview uses `VITE_API_URL` to reach the fixed preview API and its separate Neon database.

See `CLAUDE.md` before changing environment variables, databases, aliases, or deployment protection.
