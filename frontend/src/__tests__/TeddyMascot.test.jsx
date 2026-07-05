import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import TeddyMascot from "../components/TeddyMascot.jsx";
import {
  getRiveTestInput,
  resetRiveTestInputs,
} from "../test/riveRuntimeStub.js";

describe("TeddyMascot", () => {
  beforeEach(() => {
    resetRiveTestInputs();
  });

  it("tracks a mouse without rerendering and returns to the form value", () => {
    const { container } = render(<TeddyMascot lookText="Ronit" />);
    const interaction = container.querySelector(".teddy-interaction");
    interaction.getBoundingClientRect = () => ({
      bottom: 200,
      height: 200,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON() {},
    });

    fireEvent.pointerEnter(interaction, {
      clientX: 40,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(interaction, {
      clientX: 150,
      pointerType: "mouse",
    });

    expect(getRiveTestInput("isChecking").value).toBe(true);
    expect(getRiveTestInput("numLook").value).toBeCloseTo(48.5);

    fireEvent.pointerLeave(interaction, { pointerType: "mouse" });
    expect(getRiveTestInput("numLook").value).toBe(22);
  });
});
