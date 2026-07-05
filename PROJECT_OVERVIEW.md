# Project overview

Planning Poker is a React and Django application for collaborative estimation.

## Components

| Component | Location | Responsibility | Platform |
| --- | --- | --- | --- |
| React SPA | `frontend/` | Forms, room UI, voting, participant controls | Vercel Hobby |
| Django API | `backend/poker_project/` | Room lifecycle, membership, authorization, round state | Vercel Hobby |
| PostgreSQL | Vercel Neon integrations | Durable rooms, membership, votes, and round state | Neon Free |
| CI | `.github/workflows/ci.yml` | Tests, builds, migrations, and security checks | GitHub Actions |

Production browser requests use same-origin `/api`; Vercel rewrites them to the production Django project. Preview builds use the fixed preview API alias and a separate Neon Free database.

## User workflows

1. Create a named estimation room.
2. Share the room URL or session ID.
3. Join with a display name.
4. Vote with a configured planning-poker card or become a spectator.
5. Observe who has voted without exposing vote values.
6. Let the host reveal the completed round.
7. Reset into a new round.
8. Remove a participant or end the room.

## Routes and API

Frontend:

- `/` — create/join page.
- `/session/:sessionId` — credential-aware room page or deep-link join flow.

Backend API base:

- `/api/sessions/`

The complete route inventory and authorization rules are documented in `CLAUDE.md` and `AUTH_DOCUMENTATION.md`.

## Data model

- `Session` is the authoritative room and round state.
- `SessionMembership` binds one participant identity to one room.
- Signed capabilities authenticate one active membership.
- Votes stay private until the authoritative reveal.
- State-changing round operations use PostgreSQL transactions and row locks.
- SQLite is never a deployed datastore.

## Deployment state

- Frontend production: `https://my-app-tau-seven-25.vercel.app`
- Backend production: `https://planning-poker-api-ronit.vercel.app`
- Frontend preview: `https://planning-poker-preview-ronit.vercel.app`
- Backend preview: `https://planning-poker-api-preview-ronit.vercel.app`

All four are fixed free `vercel.app` aliases. Production and preview databases are separate Neon Free resources in London.

## Canonical reference

Read `CLAUDE.md` for architecture, environment variables, verification, deployment, free-tier quotas, rollback, and incident response.
