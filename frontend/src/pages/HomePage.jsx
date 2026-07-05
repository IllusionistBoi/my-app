import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { sessionsApi } from "../api.js";
import Brand from "../components/Brand.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import {
  isValidSessionId,
  normalizeSessionId,
  saveSessionToken,
} from "../sessionStore.js";

function FormField({ id, label, hint, ...inputProps }) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={hintId} {...inputProps} />
      {hint ? (
        <small id={hintId} className="field-hint">
          {hint}
        </small>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [createForm, setCreateForm] = useState({ username: "", sessionName: "" });
  const [joinForm, setJoinForm] = useState({ username: "", sessionId: "" });
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");

  async function completeEntry(action) {
    setError("");
    setPending(action);
    try {
      const response =
        action === "create"
          ? await sessionsApi.create(createForm.username, createForm.sessionName)
          : await sessionsApi.join(joinForm.username, normalizeSessionId(joinForm.sessionId));

      const session = response.session;
      saveSessionToken(session.session_id, response.participant_token);
      navigate(`/session/${session.session_id}`, {
        state: { session },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(null);
    }
  }

  function handleCreate(event) {
    event.preventDefault();
    void completeEntry("create");
  }

  function handleJoin(event) {
    event.preventDefault();
    if (!isValidSessionId(joinForm.sessionId)) {
      setError("Enter a room code in the format ABC-123-XYZ.");
      return;
    }
    void completeEntry("join");
  }

  const isBusy = pending !== null;

  return (
    <div className="home-shell">
      <header className="site-header">
        <Brand />
        <a className="text-link" href="#join-room">
          Join a room
        </a>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Quiet estimates. Better conversations.</p>
            <h1 id="hero-title">Plan together without anchoring the room.</h1>
            <p className="hero-lede">
              Everyone estimates privately. The facilitator reveals the cards only
              when the team is ready.
            </p>
            <ul className="feature-list" aria-label="Key features">
              <li>Private votes until reveal</li>
              <li>No account or install required</li>
              <li>Clear host controls for every round</li>
            </ul>
          </div>

          <div className="card-stack" aria-hidden="true">
            <span className="demo-card demo-card-back">?</span>
            <span className="demo-card demo-card-middle">8</span>
            <span className="demo-card demo-card-front">5</span>
          </div>
        </section>

        <StatusMessage message={error} />

        <section className="entry-grid" aria-label="Create or join a planning room">
          <form className="entry-card" onSubmit={handleCreate}>
            <div>
              <p className="step-number" aria-hidden="true">
                01
              </p>
              <h2>Create a room</h2>
              <p>Start a fresh estimation round and invite your team.</p>
            </div>

            <FormField
              id="create-name"
              label="Your name"
              name="username"
              type="text"
              autoComplete="name"
              minLength="1"
              maxLength="50"
              required
              value={createForm.username}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
            />
            <FormField
              id="session-name"
              label="Room name"
              name="sessionName"
              type="text"
              autoComplete="off"
              minLength="1"
              maxLength="100"
              placeholder="Sprint 42 planning"
              required
              value={createForm.sessionName}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  sessionName: event.target.value,
                }))
              }
            />
            <button className="button button-primary button-full" disabled={isBusy} type="submit">
              {pending === "create" ? "Creating…" : "Create room"}
            </button>
          </form>

          <form className="entry-card entry-card-muted" id="join-room" onSubmit={handleJoin}>
            <div>
              <p className="step-number" aria-hidden="true">
                02
              </p>
              <h2>Join your team</h2>
              <p>Use the room code shared by your facilitator.</p>
            </div>

            <FormField
              id="join-name"
              label="Your name"
              name="username"
              type="text"
              autoComplete="name"
              minLength="1"
              maxLength="50"
              required
              value={joinForm.username}
              onChange={(event) =>
                setJoinForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
            />
            <FormField
              id="session-id"
              label="Room code"
              hint="Format: ABC-123-XYZ"
              name="sessionId"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              inputMode="text"
              maxLength="11"
              placeholder="ABC-123-XYZ"
              required
              value={joinForm.sessionId}
              onChange={(event) =>
                setJoinForm((current) => ({
                  ...current,
                  sessionId: event.target.value.toUpperCase(),
                }))
              }
            />
            <button className="button button-secondary button-full" disabled={isBusy} type="submit">
              {pending === "join" ? "Joining…" : "Join room"}
            </button>
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <p>Built for focused, low-friction estimation.</p>
      </footer>
    </div>
  );
}
