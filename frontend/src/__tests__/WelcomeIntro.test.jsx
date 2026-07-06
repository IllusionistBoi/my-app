import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WelcomeIntro from "../components/WelcomeIntro.jsx";

const originalMatchMedia = window.matchMedia;

function mockReducedMotion(matches) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
  document.documentElement.classList.remove("welcome-lock");
});

describe("WelcomeIntro", () => {
  it("runs a timestamp-driven poker welcome and reaches 100 percent", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    const { container } = render(<WelcomeIntro />);

    expect(container.querySelector(".welcome-intro")).toHaveAttribute(
      "data-phase",
      "running",
    );
    expect(screen.getByText("00%")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3_200));
    expect(screen.getByText("The table is yours.")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_200));
    expect(container.querySelector(".welcome-intro")).toHaveAttribute(
      "data-phase",
      "exiting",
    );

    act(() => vi.advanceTimersByTime(700));
    expect(container.querySelector(".welcome-intro")).not.toBeInTheDocument();
  });

  it("can be skipped without waiting for the full sequence", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    const { container } = render(<WelcomeIntro />);

    fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));
    expect(container.querySelector(".welcome-intro")).toHaveAttribute(
      "data-phase",
      "skipping",
    );

    act(() => vi.advanceTimersByTime(220));
    expect(container.querySelector(".welcome-intro")).not.toBeInTheDocument();
  });

  it("does not mount moving artwork for reduced-motion users", () => {
    mockReducedMotion(true);
    const { container } = render(<WelcomeIntro />);

    expect(container.querySelector(".welcome-intro")).not.toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass("welcome-lock");
  });
});
