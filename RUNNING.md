# Running the application

`CLAUDE.md` is canonical. This is the short Windows development runbook.

## One-time setup

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend/poker_project/requirements.txt

Set-Location frontend
npm ci
Set-Location ..
```

Use Node 24 and Python 3.14.3.

## Start both processes

```powershell
.\run-dev.bat
```

Or start them manually.

Backend:

```powershell
$env:DJANGO_DEBUG="true"
$env:DJANGO_SECRET_KEY="local-only-random-value-at-least-fifty-characters-long"
$env:DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"
Set-Location backend/poker_project
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Frontend:

```powershell
Set-Location frontend
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000/api`
- Liveness: `http://127.0.0.1:8000/api/health/`
- Readiness: `http://127.0.0.1:8000/api/ready/`

Vite proxies `/api`, so no frontend environment variable is needed locally.

## Before a pull request

```powershell
Set-Location frontend
npm ci
npm test
npm run build
npm audit
npm run test:e2e

Set-Location ../backend/poker_project
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py test
python manage.py collectstatic --noinput
```

Production deployment checks require a safe secret, exact host, and database URL:

```powershell
$env:DJANGO_DEBUG="false"
$env:DJANGO_SECRET_KEY="verification-only-secret-key-with-more-than-fifty-characters"
$env:DJANGO_ALLOWED_HOSTS="example.test"
$env:DATABASE_URL="postgresql://..."
python manage.py check --deploy --fail-level WARNING
```

## Common problems

- Node engine warning: use Node 24.
- Vite command missing: run `npm ci` inside `frontend/`.
- Missing database column: run migrations; never patch a production database manually.
- CORS error: add only the exact frontend origin to `CORS_ALLOWED_ORIGINS`.
- `DisallowedHost`: add only the exact host to `DJANGO_ALLOWED_HOSTS`.
- Production mismatch: compare `/api/version/` with the intended Git SHA.
