import { createElement } from "react";

const inputs = new Map();
const rive = {
  pause() {},
  play() {},
};

export const Alignment = { Center: "center" };
export const Fit = { Contain: "contain" };
export class Layout {
  constructor(options) {
    this.options = options;
  }
}

export class RuntimeLoader {
  static setWasmUrl() {}

  static setWasmFallbackUrl() {}
}

export function useRive() {
  return {
    rive,
    RiveComponent: (props) =>
      createElement("div", {
        ...props,
        "data-testid": "rive-runtime-stub",
      }),
  };
}

export function useStateMachineInput(_rive, _stateMachine, name) {
  if (!inputs.has(name)) {
    inputs.set(name, {
      fireCount: 0,
      value: false,
      fire() {
        this.fireCount += 1;
      },
    });
  }
  return inputs.get(name);
}

export function getRiveTestInput(name) {
  return inputs.get(name);
}

export function resetRiveTestInputs() {
  inputs.clear();
}
