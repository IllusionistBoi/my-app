import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  House,
  Hourglass,
  Trash,
  UserMinus,
} from "@phosphor-icons/react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiError, sessionsApi } from "../api.js";
import Brand from "../components/Brand.jsx";
import RevealBurst from "../components/RevealBurst.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import {
  getSessionToken,
  isValidSessionId,
  normalizeSessionId,
  removeSessionToken,
  saveSessionToken,
} from "../sessionStore.js";
import { friendlyError } from "../uiCopy.js";

const VOTE_VALUES = [1, 2, 3, 5, 8, 13];
// Poll faster while a round is open (people are watching who has voted); back off once revealed,
// where the only thing left to observe is the host starting the next round.
const ACTIVE_POLL_INTERVAL_MS = 5_000;
const REVEALED_POLL_INTERVAL_MS = 9_000;

function pollIntervalFor(session) {
  return session?.is_revealed ? REVEALED_POLL_INTERVAL_MS : ACTIVE_POLL_INTERVAL_MS;
}

function toTime(value) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function newerSession(current, incoming) {
  if (!current) {
    return incoming;
  }
  if (incoming.round_number !== current.round_number) {
    return incoming.round_number > current.round_number ? incoming : current;
  }
  return toTime(incoming.updated_at) >= toTime(current.updated_at) ? incoming : current;
}

function displayNameFor(session, username) {
  return session?.display_names?.[username] || username;
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

function revealStory(results) {
  const values = Object.values(results)
    .map((result) => result.vote)
    .filter((value) => Number.isFinite(value));
  if (!values.length) {
    return {
      title: "A reveal with no cards. Bold.",
      body: "Start another round and ask the humans to pick this time.",
    };
  }

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const spread = highest - lowest;

  if (spread === 0) {
    return {
      title: "Suspiciously perfect alignment.",
      body: "Either the work is crystal clear or everyone rehearsed. Take the win.",
    };
  }
  if (spread <= 3) {
    return {
      title: "A tiny wobble, not a crisis.",
      body: `The room spans ${lowest} to ${highest}. One quick assumption check should do it.`,
    };
  }
  return {
    title: "Well, that escalated.",
    body: `The room spans ${lowest} to ${highest}. Compare the smallest and largest assumptions before anyone reaches for an average.`,
  };
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
        <h1 id="join-title">Name yourself, mysterious estimator.</h1>
        <p>The link gets you to the door. Your name gets you a chair.</p>
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
            {pending ? "Finding your chair…" : "Enter the room"}
          </button>
        </form>
        <Link className="text-link" to="/">
          Use a different room code
        </Link>
      </section>
    </main>
  );
}

function ParticipantCard({ username, displayName, voteState, session, onRemove, busy }) {
  const isCurrent = username === session.current_user.username;
  const isCreator = username === session.created_by;
  const isSpectator = Boolean(voteState?.is_spectator);

  return (
    <li className="participant-card">
      <div className="avatar" aria-hidden="true">
        {initials(displayName)}
      </div>
      <div className="participant-copy">
        <div className="participant-name">
          <strong>{displayName}</strong>
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
      <div className="participant-row-actions">
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
          {isSpectator ? (
            <Eye aria-hidden="true" size={17} weight="bold" />
          ) : session.is_revealed ? (
            (voteState?.vote ?? "—")
          ) : voteState?.has_voted ? (
            <Check aria-hidden="true" size={18} weight="bold" />
          ) : (
            <Hourglass aria-hidden="true" size={17} weight="bold" />
          )}
        </span>
        {session.current_user.is_creator && !isCreator ? (
          <button
            className="icon-button"
            disabled={busy}
            onClick={() => onRemove(username)}
            title={`Remove ${displayName}`}
            type="button"
          >
            <UserMinus aria-hidden="true" size={18} weight="bold" />
            <span className="sr-only">Remove {displayName}</span>
          </button>
        ) : null}
      </div>
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
  const [burstKey, setBurstKey] = useState(null);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);
  const actionRef = useRef(null);
  const sessionRef = useRef(initialSession);
  const previousRevealRef = useRef(initialSession?.is_revealed);

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
        setError("The room bouncer lost your name. Join again and we will restore your chair.");
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
        setNotice("The live feed blinked. Reconnecting before anyone notices…");
        return false;
      }
      setError(friendlyError(requestError));
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
      setNotice("You are off the grid. Your cards will catch up when the internet returns.");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }
    const wasRevealed = previousRevealRef.current;
    previousRevealRef.current = session.is_revealed;
    if (wasRevealed === false && session.is_revealed) {
      const nextBurst = `${session.round_number}-${session.updated_at}`;
      setBurstKey(nextBurst);
      const timer = window.setTimeout(() => setBurstKey(null), 1_600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [session]);

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
    let inFlight = false;
    let timer = null;
    let controller = null;

    const schedule = () => {
      if (!stopped) {
        timer = window.setTimeout(poll, pollIntervalFor(sessionRef.current));
      }
    };

    async function poll() {
      if (stopped || inFlight) {
        return;
      }
      if (document.hidden || actionRef.current || !window.navigator.onLine) {
        schedule();
        return;
      }

      inFlight = true;
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
        inFlight = false;
        schedule();
      }
    }

    function refreshWhenVisible() {
      // If a poll is already running it will deliver fresh state and reschedule; only kick a new
      // one when idle, so a burst of visibility events cannot stack overlapping requests.
      if (!document.hidden && !inFlight) {
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
      setNotice("Invite copied. Summon the spreadsheet survivors.");
    } catch {
      setError(`The clipboard played hard to get. Copy this instead: ${inviteUrl}`);
    }
  }

  function removeParticipant(username) {
    const label = displayNameFor(session, username);
    if (!window.confirm(`Show ${label} the door? Their current access will be revoked.`)) {
      return;
    }
    void runAction(
      `remove-${username}`,
      () => sessionsApi.removeParticipant(sessionId, username, token),
      `${label} left the table. Their card went with them.`,
    );
  }

  function deleteRoom() {
    if (!window.confirm("Burn this room to the ground? This cannot be undone.")) {
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
          <p className="error-code" aria-hidden="true">
            404
          </p>
          <p className="eyebrow">The table vanished</p>
          <h1>This room folded and left no forwarding address.</h1>
          <p>Check the code, or ask the host whether they rage-deleted it.</p>
          <Link className="button button-primary" to="/">
            Find another table
          </Link>
        </section>
      </main>
    );
  }

  if (phase === "expired") {
    return (
      <main className="centered-page" id="main-content">
        <section className="empty-state">
          <p className="eyebrow">The last call was called</p>
          <h1>This room has retired.</h1>
          <p>Old rooms expire automatically. Even backlogs deserve boundaries.</p>
          <Link className="button button-primary" to="/">
            Deal a fresh room
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
          <div className="loading-deck" aria-hidden="true">
            <i>3</i>
            <i>5</i>
            <i>8</i>
          </div>
          <p>Pulling up a chair in room {sessionId}…</p>
        </div>
      </main>
    );
  }

  const currentVote = session.votes[session.current_user.username];
  const busy = action !== null;
  const revealedStory = session.is_revealed
    ? revealStory(session.vote_results)
    : null;

  return (
    <div className="room-shell">
      <div className="grain" aria-hidden="true" />
      <RevealBurst burstKey={burstKey} />
      <header className="room-header">
        <Brand compact />
        <div className="room-header-actions">
          <button className="button button-quiet" onClick={copyInviteLink} type="button">
            <Copy aria-hidden="true" size={17} weight="bold" />
            Copy invite
          </button>
          <Link className="button button-quiet" to="/">
            <House aria-hidden="true" size={17} weight="bold" />
            Home
          </Link>
        </div>
      </header>

      <main className="room-main" id="main-content">
        <section className="room-title-row" aria-labelledby="room-title">
          <div>
            <div className="room-meta">
              <p className="eyebrow">
                Round {session.round_number} <span aria-hidden="true">/</span>{" "}
                {session.session_id}
              </p>
              <div className={`connection-pill${isOnline ? "" : " connection-offline"}`}>
                <span aria-hidden="true" />
                {isOnline ? "Live" : "Offline"}
              </div>
            </div>
            <h1 id="room-title">{session.name}</h1>
            <p>
              {session.created_by_display_name || session.created_by} is holding the gavel. This
              table vanishes {formatExpiry(session.expires_at)}.
            </p>
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
              <>
                <div className="reveal-story">
                  <p>{revealedStory.title}</p>
                  <span>{revealedStory.body}</span>
                </div>
                <div className="results-grid" aria-label="Revealed estimates">
                  {Object.entries(session.vote_results).map(([username, result], index) => (
                    <article
                      className="result-card"
                      key={username}
                      style={{ "--result-index": index }}
                    >
                      <span className="result-value">{result.vote}</span>
                      <strong>{displayNameFor(session, username)}</strong>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="vote-grid" aria-label="Estimate cards">
                {VOTE_VALUES.map((value, index) => (
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
                        `${value} locked in. Poker face on.`,
                      )
                    }
                    style={{ "--card-index": index }}
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
                      "Vote vanished. Nobody saw a thing.",
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
                          ? "Spectator mode: snacks encouraged."
                          : "You are back in the game.",
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
                    {session.is_revealed
                      ? "Run it back with a fresh hand?"
                      : readiness.allReady
                        ? "Every poker face is locked. Flip when ready."
                        : "The dramatic reveal waits for every active player."}
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
                        "Fresh round. Same mysterious backlog.",
                      )
                    }
                    type="button"
                  >
                    {action === "reset" ? "Collecting cards…" : "Deal next round"}
                  </button>
                ) : (
                  <button
                    className="button button-primary"
                    disabled={busy || !readiness.allReady}
                    onClick={() =>
                      runAction(
                        "reveal",
                        () => sessionsApi.reveal(sessionId, token),
                        "Cards up. Let the explaining begin.",
                      )
                    }
                    type="button"
                  >
                    {action === "reveal" ? "Building suspense…" : "Flip the table"}
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
                  displayName={displayNameFor(session, username)}
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
                  <Trash aria-hidden="true" size={17} weight="bold" />
                  Delete this room
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
