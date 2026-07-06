import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, LockKey, UsersThree } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

import { sessionsApi } from "../api.js";
import Brand from "../components/Brand.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import TeddyMascot from "../components/TeddyMascot.jsx";
import {
  isValidSessionId,
  normalizeSessionId,
  saveSessionToken,
} from "../sessionStore.js";
import { friendlyError } from "../uiCopy.js";

const TICKER_ITEMS = [
  "Pick quietly",
  "Reveal together",
  "Debate the gap",
  "Repeat until aligned",
];
const TICKER_GROUPS = [0, 1];
const PRIVACY_MESSAGES = [
  "Scout’s honour. Not a single point spotted.",
  "Privacy paws engaged. Your card is safe.",
  "Looking away. The backlog may proceed.",
  "No peeking. This bear has standards.",
  "Eyes covered. Opinions stay unanchored.",
  "Your estimate is none of my bear business.",
];
const PRIVACY_BEAT_INTERVAL = 5_000;
const PRIVACY_POSE_DURATION = 1_700;
const PRIVACY_MESSAGE_DURATION = 2_400;

function FormField({ id, label, hint, ...inputProps }) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby={hintId}
        {...inputProps}
      />
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
  const [mascotSignal, setMascotSignal] = useState(null);
  const [privacyBeat, setPrivacyBeat] = useState({
    active: false,
    handsUp: false,
    index: 0,
  });

  useEffect(() => {
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    let messageTimer = 0;
    let poseTimer = 0;
    let intervalTimer = 0;
    let nextIndex = 0;

    const stop = () => {
      window.clearTimeout(messageTimer);
      window.clearTimeout(poseTimer);
      window.clearInterval(intervalTimer);
      messageTimer = 0;
      poseTimer = 0;
      intervalTimer = 0;
      setPrivacyBeat((current) => ({
        ...current,
        active: false,
        handsUp: false,
      }));
    };

    const beginBeat = () => {
      setPrivacyBeat({ active: true, handsUp: true, index: nextIndex });
      nextIndex = (nextIndex + 1) % PRIVACY_MESSAGES.length;
      window.clearTimeout(messageTimer);
      window.clearTimeout(poseTimer);
      poseTimer = window.setTimeout(() => {
        setPrivacyBeat((current) => ({ ...current, handsUp: false }));
      }, PRIVACY_POSE_DURATION);
      messageTimer = window.setTimeout(() => {
        setPrivacyBeat((current) => ({ ...current, active: false }));
      }, PRIVACY_MESSAGE_DURATION);
    };

    const sync = () => {
      stop();
      if (!media?.matches) {
        intervalTimer = window.setInterval(beginBeat, PRIVACY_BEAT_INTERVAL);
      }
    };

    sync();
    media?.addEventListener?.("change", sync);
    return () => {
      media?.removeEventListener?.("change", sync);
      window.clearTimeout(messageTimer);
      window.clearTimeout(poseTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  const mascotHandsUp = privacyBeat.handsUp;
  const mascotMessage = error
    ? "That was not in the script."
    : privacyBeat.active
      ? PRIVACY_MESSAGES[privacyBeat.index]
      : "Move your cursor. I will follow.";

  function signalMascot(type) {
    setMascotSignal({ type, id: window.crypto.randomUUID() });
  }

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
      signalMascot("success");
      navigate(`/session/${session.session_id}`, {
        state: { session },
      });
    } catch (requestError) {
      setError(friendlyError(requestError));
      signalMascot("error");
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
      setError("That code is wearing the wrong outfit. Use ABC-123-XYZ.");
      signalMascot("error");
      return;
    }
    void completeEntry("join");
  }

  const isBusy = pending !== null;

  return (
    <div className="home-shell">
      <div className="grain" aria-hidden="true" />
      <header className="site-header">
        <Brand />
        <a className="header-link" href="#join-room">
          Join a room <ArrowDown aria-hidden="true" size={15} weight="bold" />
        </a>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">Planning without the poker face</p>
            <h1 id="hero-title">
              Call the bluff.
              <span>Find the estimate.</span>
            </h1>
            <p className="hero-lede">
              Everyone picks in private. The cards flip together. Loud opinions can
              wait their turn.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#create-room">
                Deal a new room <ArrowRight aria-hidden="true" size={18} weight="bold" />
              </a>
              <a className="button button-ghost" href="#how-it-works">
                See the trick
              </a>
            </div>
            <ul className="trust-row" aria-label="Key features">
              <li>
                <LockKey aria-hidden="true" size={17} weight="bold" />
                Secret until reveal
              </li>
              <li>
                <UsersThree aria-hidden="true" size={18} weight="bold" />
                No accounts, no nonsense
              </li>
            </ul>
          </div>

          <aside className="mascot-stage" aria-label="Meet the planning room mascot">
            <div className="mascot-orbit orbit-one" aria-hidden="true">
              8
            </div>
            <div className="mascot-orbit orbit-two" aria-hidden="true">
              13
            </div>
            <div className="mascot-speech" aria-live="polite">
              {mascotMessage}
            </div>
            <div className="mascot-frame">
              <TeddyMascot
                handsUp={mascotHandsUp}
                signal={mascotSignal}
              />
            </div>
          </aside>
        </section>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {TICKER_GROUPS.map((group) => (
              <div className="ticker-group" key={group}>
                {TICKER_ITEMS.map((item) => (
                  <span className="ticker-item" key={`${group}-${item}`}>
                    {item}
                    <i />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section className="entry-section" aria-labelledby="entry-title">
          <div className="entry-intro">
            <p className="eyebrow">Choose your entrance</p>
            <h2 id="entry-title">Host the table or slide into one.</h2>
            <p>
              No signup ceremony. Just a name, a room, and one backlog item everyone
              swore was “basically done.”
            </p>
          </div>

          <StatusMessage message={error} />

          <div className="entry-grid" aria-label="Create or join a planning room">
            <form className="entry-card entry-card-create" id="create-room" onSubmit={handleCreate}>
              <div className="entry-card-heading">
                <span className="step-number" aria-hidden="true">
                  01
                </span>
                <div>
                  <p className="eyebrow">You have the gavel</p>
                  <h3>Create a room</h3>
                  <p>Start a round and summon your favourite estimators.</p>
                </div>
              </div>

              <FormField
                id="create-name"
                label="What should we call you?"
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
                label="Name this tiny democracy"
                name="sessionName"
                type="text"
                autoComplete="off"
                minLength="1"
                maxLength="100"
                placeholder="The sprint that definitely fits"
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
                <span>{pending === "create" ? "Shuffling the deck…" : "Deal a room"}</span>
                <ArrowRight aria-hidden="true" size={18} weight="bold" />
              </button>
            </form>

            <form
              className="entry-card entry-card-join"
              id="join-room"
              onSubmit={handleJoin}
            >
              <div className="entry-card-heading">
                <span className="step-number" aria-hidden="true">
                  02
                </span>
                <div>
                  <p className="eyebrow">You know someone inside</p>
                  <h3>Join a room</h3>
                  <p>Bring the code. Leave the anchoring bias at the door.</p>
                </div>
              </div>

              <FormField
                id="join-name"
                label="What should we call you?"
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
                label="Secret-ish room code"
                hint="The costume is always ABC-123-XYZ."
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
                <span>{pending === "join" ? "Finding your chair…" : "Take a seat"}</span>
                <ArrowRight aria-hidden="true" size={18} weight="bold" />
              </button>
            </form>
          </div>
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="how-heading">
            <p className="eyebrow">The whole magic trick</p>
            <h2 id="how-title">Three beats. Zero theatre.</h2>
          </div>
          <ol className="how-list">
            <li>
              <span>01</span>
              <div>
                <h3>Pick your card</h3>
                <p>Your estimate stays yours. No accidental anchoring.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Flip together</h3>
                <p>The host reveals only when every active player is ready.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Talk about the gap</h3>
                <p>The interesting bit is not the number. It is why the numbers differ.</p>
              </div>
            </li>
          </ol>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
