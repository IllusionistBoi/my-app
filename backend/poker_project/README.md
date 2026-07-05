# Planning Poker API

Django 5.2 REST API for short-lived estimation rooms. The canonical project and operations reference is the repository-root `CLAUDE.md`.

## Local setup

From the repository root:

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

SQLite is used only when debug or tests are explicit and `DATABASE_URL` is absent. Production fails closed without a secret, allowed host, and managed database.

## Security model

Create and join return a high-entropy, signed participant capability. It is scoped to one membership and room, stored as a one-way nonce digest, and sent as `Authorization: Bearer <capability>`.

- Members may read their room.
- Members may mutate only their own vote/spectator state.
- Only the host may reveal, reset, remove participants, or delete the room.
- Other vote values stay hidden until the server reveals the round.
- Removed, expired, tampered, cross-room, and old-key capabilities fail.

See `AUTH_DOCUMENTATION.md` at the repository root for the full endpoint matrix.

## Verification

```powershell
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py test --verbosity 2
python manage.py collectstatic --noinput
python manage.py purge_expired_sessions --dry-run
```

CI runs these checks on PostgreSQL and runs Django's deployment check with production-safe settings.

## Health

- `/api/health/` — process liveness and commit.
- `/api/ready/` — database readiness.
- `/api/version/` — commit and deployment environment.

Production uses Vercel's zero-configuration Django/Python runtime, WhiteNoise/CDN static handling, JSON stdout logs, request IDs, HTTPS/HSTS, throttling, and Neon Free PostgreSQL. Deployment settings live in `vercel.json`; secrets and database URLs are scoped in the Vercel project.
