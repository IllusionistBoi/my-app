import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiError, sessionsApi } from "../api.js";
import Brand from "../components/Brand.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import {
  getSessionToken,
  isValidSessionId,
  normalizeSessionId,
  removeSessionToken,
  saveSessionToken,
} from "../sessionStore.js";

const VOTE_VALUES = [1, 2, 3, 5, 8, 13];
const POLL_INTERVAL_MS = 4_000;

function newerSession(current, incoming) {
  if (!current) {
    return incoming;
  }
  if (incoming.round_number !== current.round_number) {
    return incoming.round_number > current.round_number ? incoming : current;
  }
  return incoming.updated_at >= current.updated_at ? incoming : current;
}

function initials(username) {
  return username
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function formatExpiry(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "soon";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DeepLinkJoin({ sessionId, onJoined, pending, error }) {
  const [username, setUsername] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    await onJoined(username);
  }

  return (
    <main className="centered-page" id="main-content">
      <section className="join-panel" aria-labelledby="join-title">
        <Brand />
        <p className="eyebrow">Room {sessionId}</p>
        <h1 id="join-title">Introduce yourself to join.</h1>
        <p>Your room link never carries someone else’s identity or private access.</p>
        <StatusMessage message={error} />
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="deep-link-name">Your name</label>
            <input
              autoComplete="name"
              autoFocus
              id="deep-link-name"
              maxLength="50"
              minLength="1"
              onChange={(event) => setUsername(event.target.value)}
              required
              type="text"
              value={username}
            />
          </div>
          <button className="button button-primary button-full" disabled={pending} type="submit">
            {pending ? "Joining…" : "Join room"}
          </button>
        </form>
        <Link className="text-link" to="/">
          Use a different room code
        </Link>
      </section>
    </main>
  );
}

function ParticipantCard({ username, voteState, session, onRemove, busy }) {
  const isCurrent = username === session.current_user.username;
  const isCreator = username === session.created_by;
  const isSpectator = Boolean(voteState?.is_spectator);

  return (
    <li className="participant-card">
      <div className="avatar" aria-hidden="true">
        {initials(username)}
      </div>
      <div className="participant-copy">
        <div className="participant-name">
          <strong>{username}</strong>
          {isCurrent ? <span className="badge">You</span> : null}
          {isCreator ? <span className="badge badge-dark">Host</span> : null}
        </div>
        <span className="participant-status">
          {isSpectator
            ? "Watching"
            : session.is_revealed
              ? `Voted ${voteState?.vote ?? "—"}`
              : voteState?.has_voted
                ? "Vote locked in"
                : "Choosing a card"}
        </span>
      </div>
      <span
        className={`vote-indicator${voteState?.has_voted ? " vote-indicator-ready" : ""}`}
        aria-label={
          isSpectator
            ? "Spectator"
            : voteState?.has_voted
              ? session.is_revealed
                ? `Vote ${voteState.vote}`
                : "Vote submitted"
              : "Waiting for vote"
        }
      >
        {isSpectator ? "○" : session.is_revealed ? (voteState?.vote ?? "—") : voteState?.has_voted ? "✓" : "…"}
      </span>
      {session.current_user.is_creator && !isCreator ? (
        <button
          className="icon-button"
          disabled={busy}
          onClick={() => onRemove(username)}
          title={`Remove ${username}`}
          type="button"
        >
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove {username}</span>
        </button>
      ) : null}
    </li>
  );
}

export default function RoomPage() {
  const { sessionId: routeSessionId } = useParams();
  const sessionId = normalizeSessionId(routeSessionId);
  const location = useLocation();
  const navigate = useNavigate();
  const initialSession =
    location.state?.session?.session_id === sessionId ? location.state.session : null;

  const [token, setToken] = useState(() => getSessionToken(sessionId));
  const [session, setSession] = useState(initialSession);
  const [phase, setPhase] = useState(token ? "loading" : "join");
  const [action, setAction] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);
  const actionRef = useRef(null);
  const sessionRef = useRef(initialSession);

  const applySession = useCallback((incoming) => {
    const next = newerSession(sessionRef.current, incoming);
    sessionRef.current = next;
    setSession(next);
    setPhase("ready");
  }, []);

  const handleAccessError = useCallback(
    (requestError, { background = false } = {}) => {
      if (requestError.status === 401 || requestError.status === 403) {
        removeSessionToken(sessionId);
        setToken(null);
        setSession(null);
        sessionRef.current = null;
        setPhase("join");
        setError("Your access to this room expired or was revoked. Join again to continue.");
        return true;
      }
      if (requestError.status === 404) {
        setPhase("missing");
        setError("");
        return true;
      }
      if (requestError.status === 410) {
        removeSessionToken(sessionId);
        setPhase("expired");
        setError("");
        return true;
      }
      if (requestError.code === "request_cancelled") {
        return true;
      }
      if (background) {
        setNotice("Live updates are paused. Reconnecting…");
        return false;
      }
      setError(requestError.message);
      return false;
    },
    [sessionId],
  );

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setNotice("");
    };
    const goOffline = () => {
      setIsOnline(false);
      setNotice("You are offline. Your room will update when the connection returns.");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!isValidSessionId(sessionId)) {
      setPhase("missing");
      return undefined;
    }
    if (!token) {
      setPhase((current) => (current === "missing" || current === "expired" ? current : "join"));
      return undefined;
    }

    let stopped = false;
    let timer = null;
    let controller = null;

    const schedule = () => {
      if (!stopped) {
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    async function poll() {
      if (stopped) {
        return;
      }
      if (document.hidden || actionRef.current || !window.navigator.onLine) {
        schedule();
        return;
      }

      controller = new AbortController();
      try {
        const incoming = await sessionsApi.details(sessionId, token, {
          signal: controller.signal,
        });
        if (!stopped) {
          applySession(incoming);
          setNotice("");
          setError("");
        }
      } catch (requestError) {
        if (!stopped) {
          handleAccessError(requestError, { background: Boolean(sessionRef.current) });
        }
      } finally {
        schedule();
      }
    }

    function refreshWhenVisible() {
      if (!document.hidden) {
        window.clearTimeout(timer);
        void poll();
      }
    }

    void poll();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [applySession, handleAccessError, sessionId, token]);

  async function joinRoom(username) {
    setError("");
    setAction("join");
    actionRef.current = "join";
    try {
      const response = await sessionsApi.join(username, sessionId);
      saveSessionToken(sessionId, response.participant_token);
      setToken(response.participant_token);
      applySession(response.session);
    } catch (requestError) {
      handleAccessError(requestError);
    } finally {
      actionRef.current = null;
      setAction(null);
    }
  }

  async function runAction(name, requestAction, successMessage) {
    if (actionRef.current) {
      return;
    }
    setError("");
    setNotice("");
    setAction(name);
    actionRef.current = name;
    try {
      const response = await requestAction();
      if (response?.session) {
        applySession(response.session);
      }
      if (successMessage) {
        setNotice(successMessage);
      }
    } catch (requestError) {
      handleAccessError(
        requestError instanceof ApiError
          ? requestError
          : new ApiError("The action could not be completed."),
      );
    } finally {
      actionRef.current = null;
      setAction(null);
    }
  }

  async function copyInviteLink() {
    const inviteUrl = `${window.location.origin}/session/${sessionId}`;
    try {
      await window.navigator.clipboard.writeText(inviteUrl);
      setNotice("Invite link copied.");
    } catch {
      setError(`Copy failed. Share this link: ${inviteUrl}`);
    }
  }

  function removeParticipant(username) {
    if (!window.confirm(`Remove ${username} from this room? Their current access will be revoked.`)) {
      return;
    }
    void runAction(
      `remove-${username}`,
      () => sessionsApi.removeParticipant(sessionId, username, token),
      `${username} was removed.`,
    );
  }

  function deleteRoom() {
    if (!window.confirm("Delete this room permanently? This cannot be undone.")) {
      return;
    }
    void runAction("delete", async () => {
      const response = await sessionsApi.deleteSession(sessionId, token);
      removeSessionToken(sessionId);
      navigate("/", { replace: true });
      return response;
    });
  }

  const readiness = useMemo(() => {
    if (!session) {
      return { eligible: 0, ready: 0, allReady: false };
    }
    const eligibleVotes = Object.values(session.votes).filter(
      (vote) => !vote.is_spectator,
    );
    const ready = eligibleVotes.filter((vote) => vote.has_voted).length;
    return {
      eligible: eligibleVotes.length,
      ready,
      allReady: eligibleVotes.length > 0 && ready === eligibleVotes.length,
    };
  }, [session]);

  if (!isValidSessionId(sessionId) || phase === "missing") {
    return (
      <main className="centered-page" id="main-content">
        <section className="empty-state">
          <p className="eyebrow">Room not found</p>
          <h1>Check the invite link or room code.</h1>
          <p>This room may have been deleted, or the code may be incomplete.</p>
          <Link className="button button-primary" to="/">
            Back home
          </Link>
        </section>
      </main>
    );
  }

  if (phase === "expired") {
    return (
      <main className="centered-page" id="main-content">
        <section className="empty-state">
          <p className="eyebrow">Room expired</p>
          <h1>This planning room has closed.</h1>
          <p>Rooms expire automatically to keep old participant data from lingering.</p>
          <Link className="button button-primary" to="/">
            Create a new room
          </Link>
        </section>
      </main>
    );
  }

  if (!token || phase === "join") {
    return (
      <DeepLinkJoin
        error={error}
        onJoined={joinRoom}
        pending={action === "join"}
        sessionId={sessionId}
      />
    );
  }

  if (!session || phase === "loading") {
    return (
      <main className="centered-page" id="main-content">
        <div className="loading-state" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>Opening room {sessionId}…</p>
        </div>
      </main>
    );
  }

  const currentVote = session.votes[session.current_user.username];
  const busy = action !== null;

  return (
    <div className="room-shell">
      <header className="room-header">
        <Brand compact />
        <div className="room-header-actions">
          <button className="button button-quiet" onClick={copyInviteLink} type="button">
            Copy invite link
          </button>
          <Link className="button button-quiet" to="/">
            Home
          </Link>
        </div>
      </header>

      <main className="room-main" id="main-content">
        <section className="room-title-row" aria-labelledby="room-title">
          <div>
            <p className="eyebrow">
              Round {session.round_number} · {session.session_id}
            </p>
            <h1 id="room-title">{session.name}</h1>
            <p>
              Hosted by {session.created_by}. Room expires {formatExpiry(session.expires_at)}.
            </p>
          </div>
          <div className={`connection-pill${isOnline ? "" : " connection-offline"}`}>
            <span aria-hidden="true" />
            {isOnline ? "Live" : "Offline"}
          </div>
        </section>

        <StatusMessage message={error} />
        <StatusMessage message={notice} tone="info" />

        <div className="room-layout">
          <section className="workspace-panel" aria-labelledby="vote-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {session.is_revealed ? "Cards revealed" : "Your estimate"}
                </p>
                <h2 id="vote-title">
                  {session.current_user.is_spectator
                    ? "You are watching this round"
                    : session.is_revealed
                      ? "Discuss the spread"
                      : "Choose one card"}
                </h2>
              </div>
              {!session.is_revealed ? (
                <span className="readiness">
                  {readiness.ready}/{readiness.eligible} ready
                </span>
              ) : null}
            </div>

            {session.is_revealed ? (
              <div className="results-grid" aria-label="Revealed estimates">
                {Object.entries(session.vote_results).map(([username, result]) => (
                  <article className="result-card" key={username}>
                    <span className="result-value">{result.vote}</span>
                    <strong>{username}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <div className="vote-grid" aria-label="Estimate cards">
                {VOTE_VALUES.map((value) => (
                  <button
                    aria-label={`${value} points`}
                    aria-pressed={currentVote?.vote === value}
                    className={`vote-card${currentVote?.vote === value ? " vote-card-selected" : ""}`}
                    disabled={busy || session.current_user.is_spectator}
                    key={value}
                    onClick={() =>
                      runAction(
                        `vote-${value}`,
                        () => sessionsApi.castVote(sessionId, value, token),
                        `Vote ${value} saved.`,
                      )
                    }
                    type="button"
                  >
                    <span>{value}</span>
                    <small>points</small>
                  </button>
                ))}
              </div>
            )}

            <div className="workspace-actions">
              {!session.is_revealed && !session.current_user.is_spectator ? (
                <button
                  className="button button-quiet"
                  disabled={busy || !currentVote?.has_voted}
                  onClick={() =>
                    runAction(
                      "clear",
                      () => sessionsApi.clearVote(sessionId, token),
                      "Vote cleared.",
                    )
                  }
                  type="button"
                >
                  Clear my vote
                </button>
              ) : null}
              {!session.is_revealed ? (
                <label className="spectator-control">
                  <input
                    checked={session.current_user.is_spectator}
                    disabled={busy}
                    onChange={(event) =>
                      runAction(
                        "spectator",
                        () =>
                          sessionsApi.setSpectator(
                            sessionId,
                            event.target.checked,
                            token,
                          ),
                        event.target.checked
                          ? "You are watching this round."
                          : "You can vote again.",
                      )
                    }
                    type="checkbox"
                  />
                  <span>Watch as a spectator</span>
                </label>
              ) : null}
            </div>

            {session.current_user.is_creator ? (
              <div className="host-controls" aria-labelledby="host-controls-title">
                <div>
                  <p className="eyebrow">Host controls</p>
                  <h3 id="host-controls-title">
                    {session.is_revealed ? "Ready for another round?" : "Reveal when everyone is ready."}
                  </h3>
                </div>
                {session.is_revealed ? (
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        "reset",
                        () => sessionsApi.reset(sessionId, token),
                        "A new round is ready.",
                      )
                    }
                    type="button"
                  >
                    {action === "reset" ? "Resetting…" : "Start next round"}
                  </button>
                ) : (
                  <button
                    className="button button-primary"
                    disabled={busy || !readiness.allReady}
                    onClick={() =>
                      runAction(
                        "reveal",
                        () => sessionsApi.reveal(sessionId, token),
                        "Votes revealed.",
                      )
                    }
                    type="button"
                  >
                    {action === "reveal" ? "Revealing…" : "Reveal cards"}
                  </button>
                )}
              </div>
            ) : null}
          </section>

          <aside className="people-panel" aria-labelledby="participants-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">The room</p>
                <h2 id="participants-title">Participants</h2>
              </div>
              <span className="participant-count">{session.participants.length}</span>
            </div>
            <ul className="participant-list">
              {session.participants.map((username) => (
                <ParticipantCard
                  busy={busy}
                  key={username}
                  onRemove={removeParticipant}
                  session={session}
                  username={username}
                  voteState={session.votes[username]}
                />
              ))}
            </ul>
            {session.current_user.is_creator ? (
              <div className="danger-zone">
                <button
                  className="text-button text-button-danger"
                  disabled={busy}
                  onClick={deleteRoom}
                  type="button"
                >
                  Delete this room
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
