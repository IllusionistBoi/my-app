import { useCallback, useEffect, useRef, useState } from "react";

const INTRO_STEPS = [
  { at: 0, text: "Hello." },
  { at: 560, text: "Cards down." },
  { at: 1_120, text: "Poker faces on." },
  { at: 1_760, text: "Opinions parked." },
  { at: 2_440, text: "Deck shuffled." },
  { at: 3_200, text: "The table is yours.", final: true },
];

const SEQUENCE_DURATION = 4_300;
const EXIT_DURATION = 700;
const QUICK_EXIT_DURATION = 220;
const FINAL_STEP_AT = INTRO_STEPS.at(-1).at;

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function WelcomeIntro() {
  const [phase, setPhase] = useState(() =>
    prefersReducedMotion() ? "gone" : "running",
  );
  const wordRef = useRef(null);
  const countRef = useRef(null);
  const timersRef = useRef(new Set());
  const cleanupSequenceRef = useRef(() => {});
  const finishedRef = useRef(phase === "gone");

  const schedule = useCallback((callback, delay) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  const finish = useCallback(
    (quick = false) => {
      if (finishedRef.current) {
        return;
      }
      finishedRef.current = true;
      cleanupSequenceRef.current();
      document.documentElement.classList.remove("welcome-lock");
      setPhase(quick ? "skipping" : "exiting");
      schedule(
        () => setPhase("gone"),
        quick ? QUICK_EXIT_DURATION : EXIT_DURATION,
      );
    },
    [schedule],
  );

  useEffect(() => {
    if (finishedRef.current) {
      return undefined;
    }

    document.documentElement.classList.add("welcome-lock");
    const startedAt = performance.now();
    let currentStep = 0;
    let driveTimer = 0;
    let failsafe = 0;

    const showStep = (index) => {
      const step = INTRO_STEPS[index];
      const word = wordRef.current;
      if (!word) {
        return;
      }
      word.textContent = step.text;
      word.classList.toggle("welcome-word-final", Boolean(step.final));
      word.getAnimations?.().forEach((animation) => animation.cancel());
      word.animate?.(
        [
          {
            opacity: step.final ? 0 : 0.18,
            transform: step.final
              ? "translateY(0.75rem) scale(0.96)"
              : "translateY(0.45rem)",
          },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        {
          duration: step.final ? 420 : 170,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        },
      );
    };

    const drive = () => {
      if (finishedRef.current) {
        return;
      }
      const elapsed = performance.now() - startedAt;
      const progress = Math.min(100, Math.round((elapsed / FINAL_STEP_AT) * 100));
      if (countRef.current) {
        countRef.current.textContent = `${String(progress).padStart(2, "0")}%`;
      }

      let nextStep = 0;
      for (let index = 1; index < INTRO_STEPS.length; index += 1) {
        if (elapsed >= INTRO_STEPS[index].at) {
          nextStep = index;
        }
      }
      if (nextStep !== currentStep) {
        currentStep = nextStep;
        showStep(currentStep);
      }

      if (elapsed >= SEQUENCE_DURATION) {
        finish();
        return;
      }
      driveTimer = window.setTimeout(drive, 40);
    };

    showStep(0);
    drive();
    const catchUp = () => drive();
    document.addEventListener("visibilitychange", catchUp);
    failsafe = schedule(() => finish(true), 7_000);

    const cleanupSequence = () => {
      window.clearTimeout(driveTimer);
      window.clearTimeout(failsafe);
      timersRef.current.delete(failsafe);
      document.removeEventListener("visibilitychange", catchUp);
      document.documentElement.classList.remove("welcome-lock");
      cleanupSequenceRef.current = () => {};
    };
    cleanupSequenceRef.current = cleanupSequence;
    return cleanupSequence;
  }, [finish, schedule]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
      document.documentElement.classList.remove("welcome-lock");
    },
    [],
  );

  if (phase === "gone") {
    return null;
  }

  return (
    <div className={`welcome-intro welcome-intro-${phase}`} data-phase={phase}>
      <span className="sr-only" role="status">
        Preparing the Planning Poker table.
      </span>
      <span className="welcome-panel welcome-panel-top" aria-hidden="true" />
      <span className="welcome-panel welcome-panel-bottom" aria-hidden="true" />
      <p className="welcome-word" ref={wordRef} aria-hidden="true">
        Hello.
      </p>
      <div className="welcome-progress" aria-hidden="true">
        <span ref={countRef}>00%</span>
        <small>Preparing a suspiciously fair table</small>
      </div>
      <button
        className="welcome-skip"
        type="button"
        onClick={() => finish(true)}
      >
        Skip intro
      </button>
    </div>
  );
}
