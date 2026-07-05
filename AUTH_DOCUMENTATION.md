# Authentication and authorization

## Security boundary

A username is display data, not proof of identity.

The legacy public endpoint that minted a global JWT for any supplied username is not a valid production authentication design. It allows an attacker to claim the room creator's name and must not be used as an authorization boundary.

The application implements a session-scoped capability model:

1. `create` atomically creates a room, creator membership, and a high-entropy creator capability.
2. `join` atomically creates a participant membership and a separate high-entropy participant capability.
3. The frontend stores a capability by session ID, never as one global identity.
4. API requests present the capability in the `Authorization` header.
5. The server derives the actor, room, membership, and host status from the verified capability. It never trusts `username`, `current_user`, or role fields from a request body.
6. Removing a participant or expiring a room makes that capability unusable through an authoritative membership check.

Capabilities must be transmitted only over HTTPS and must never be logged.

## Authorization matrix

| Operation | Anonymous | Member | Host |
| --- | --- | --- | --- |
| Create room | Allowed, throttled | N/A | N/A |
| Join room | Allowed, throttled | N/A | N/A |
| Read room | Denied | Own room only | Own room only |
| Cast/clear vote | Denied | Self only | Self only |
| Change spectator status | Denied | Self only | Self only |
| Reveal/reset round | Denied | Denied | Allowed |
| Remove participant | Denied | Denied | Allowed; creator cannot be removed |
| Delete room | Denied | Denied | Allowed |

Before reveal, a member may see their own vote and only `has_voted` for other participants. Raw votes become visible only after the server marks the round revealed.

## Capability requirements

- Generate with a cryptographically secure random source.
- Store only a one-way digest server-side where practical.
- Bind to exactly one membership and one room.
- Reference an active membership and its current nonce digest so rotation/removal remains authoritative.
- Enforce both a signed maximum age and the shorter authoritative room expiry.
- Compare secrets using constant-time operations.
- Return the plaintext capability only when create/join succeeds.
- Redact `Authorization`, cookies, and capability fields from logs and error reporting.

## Browser storage

The SPA stores each room capability in `sessionStorage` under a namespaced key containing the canonical session ID. It clears that entry on room deletion, expiry, removal, or an authoritative 401/403 response. Deep links carry only the room code and always ask a new tab to join.

Browser storage remains accessible to injected JavaScript, so the strict Content Security Policy and absence of unsafe HTML/script patterns are part of the security boundary. A future same-origin HttpOnly cookie design is stronger, but it also requires a complete CSRF design. Do not mix half of each model.

## Error behavior

- `401` — missing, malformed, expired, or revoked capability.
- `403` — authenticated membership lacks permission for the action.
- `404` — room does not exist, or conceal its existence from a non-member.
- `409` — round/version conflict or invalid state transition.
- `429` — anonymous or per-member throttle exceeded.

Clients must not convert authorization failures into automatic retries.

## Rotation and incident response

The old Django signing key was committed publicly. The replacement Vercel deployment uses newly generated environment-scoped keys. For any future rotation:

1. Generate a new `DJANGO_SECRET_KEY` in the backend Vercel project.
2. Invalidate all values signed with the old key.
3. Reset privileged Django credentials.
4. Remove the old key and database from the current tree.
5. Rewrite affected Git history and coordinate a fresh clone for collaborators.
6. Review Vercel, Neon, and application logs for suspicious room/admin activity.

See `CLAUDE.md` for the full incident and rollback runbook.
