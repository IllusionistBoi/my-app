import { createElement } from "react";

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
    rive: null,
    RiveComponent: (props) =>
      createElement("div", {
        ...props,
        "data-testid": "rive-runtime-stub",
      }),
  };
}

export function useStateMachineInput() {
  return null;
}
