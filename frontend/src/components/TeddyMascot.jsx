import { useEffect, useMemo, useState } from "react";
import { RuntimeLoader } from "@rive-app/canvas-lite";
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useStateMachineInput,
} from "@rive-app/react-canvas-lite";

import teddySource from "../assets/poker-teddy.riv?url";

const STATE_MACHINE = "Login Machine";
const RIVE_RUNTIME_VERSION = "2.38.4";

RuntimeLoader.setWasmUrl(
  `https://unpkg.com/@rive-app/canvas-lite@${RIVE_RUNTIME_VERSION}/rive.wasm`,
);
RuntimeLoader.setWasmFallbackUrl(
  `https://cdn.jsdelivr.net/npm/@rive-app/canvas-lite@${RIVE_RUNTIME_VERSION}/rive.wasm`,
);

export default function TeddyMascot({
  handsUp = false,
  lookText = "",
  signal = null,
}) {
  const [failed, setFailed] = useState(false);
  const layout = useMemo(
    () =>
      new Layout({
        fit: Fit.Contain,
        alignment: Alignment.Center,
      }),
    [],
  );
  const { rive, RiveComponent } = useRive({
    src: teddySource,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    layout,
    onLoadError: () => setFailed(true),
  });
  const isChecking = useStateMachineInput(rive, STATE_MACHINE, "isChecking");
  const isHandsUp = useStateMachineInput(rive, STATE_MACHINE, "isHandsUp");
  const lookPosition = useStateMachineInput(rive, STATE_MACHINE, "numLook");
  const successTrigger = useStateMachineInput(rive, STATE_MACHINE, "trigSuccess");
  const failTrigger = useStateMachineInput(rive, STATE_MACHINE, "trigFail");

  useEffect(() => {
    if (isChecking) {
      isChecking.value = lookText.trim().length > 0;
    }
    if (lookPosition) {
      lookPosition.value = Math.min(lookText.length * 4.4, 100);
    }
  }, [isChecking, lookPosition, lookText]);

  useEffect(() => {
    if (isHandsUp) {
      isHandsUp.value = handsUp;
    }
  }, [handsUp, isHandsUp]);

  useEffect(() => {
    if (!signal) {
      return;
    }
    if (signal.type === "success") {
      successTrigger?.fire();
    }
    if (signal.type === "error") {
      failTrigger?.fire();
    }
  }, [failTrigger, signal, successTrigger]);

  useEffect(() => {
    if (!rive || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (media.matches) {
        rive.pause();
      } else {
        rive.play();
      }
    };
    syncPlayback();
    media.addEventListener?.("change", syncPlayback);
    return () => media.removeEventListener?.("change", syncPlayback);
  }, [rive]);

  if (failed) {
    return (
      <div className="teddy-fallback" aria-hidden="true">
        <span className="teddy-ear teddy-ear-left" />
        <span className="teddy-ear teddy-ear-right" />
        <span className="teddy-face">
          <i />
          <i />
          <b />
        </span>
      </div>
    );
  }

  return <RiveComponent className="teddy-canvas" aria-hidden="true" />;
}
