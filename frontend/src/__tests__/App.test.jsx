import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "../pages/HomePage.jsx";
import RoomPage from "../pages/RoomPage.jsx";
import { getSessionToken, saveSessionToken } from "../sessionStore.js";

vi.mock("../api.js", () => ({
  ApiError: class ApiError extends Error {},
  sessionsApi: {
    castVote: vi.fn(),
    clearVote: vi.fn(),
    create: vi.fn(),
    deleteSession: vi.fn(),
    details: vi.fn(),
    join: vi.fn(),
    removeParticipant: vi.fn(),
    reset: vi.fn(),
    reveal: vi.fn(),
    setSpectator: vi.fn(),
  },
}));

import { sessionsApi } from "../api.js";

const baseSession = {
  session_id: "ABC-123-XYZ",
  name: "Sprint planning",
  created_by: "alice",
  participants: ["alice"],
  votes: {
    alice: {
      vote: null,
      is_spectator: false,
      has_voted: false,
    },
  },
  vote_results: {},
  round_number: 1,
  is_revealed: false,
  created_at: "2026-07-05T08:00:00Z",
  updated_at: "2026-07-05T08:00:00Z",
  expires_at: "2026-07-12T08:00:00Z",
  current_user: {
    username: "alice",
    is_creator: true,
    is_spectator: false,
  },
};

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session/:sessionId" element={<h1>Room opened</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderRoom() {
  return render(
    <MemoryRouter initialEntries={["/session/ABC-123-XYZ"]}>
      <Routes>
        <Route path="/session/:sessionId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("planning-poker workflows", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    sessionsApi.details.mockResolvedValue(baseSession);
  });

  it("creates a room, stores only that room's capability, and navigates", async () => {
    const user = userEvent.setup();
    sessionsApi.create.mockResolvedValue({
      participant_token: "creator-capability",
      session: baseSession,
    });
    renderHome();

    await user.type(screen.getByLabelText("Your name", { selector: "#create-name" }), "Alice");
    await user.type(screen.getByLabelText("Room name"), "Sprint planning");
    await user.click(screen.getByRole("button", { name: "Create room" }));

    expect(await screen.findByRole("heading", { name: "Room opened" })).toBeInTheDocument();
    expect(sessionsApi.create).toHaveBeenCalledWith("Alice", "Sprint planning");
    expect(getSessionToken("ABC-123-XYZ")).toBe("creator-capability");
  });

  it("validates a room code before trying to join", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.type(screen.getByLabelText("Your name", { selector: "#join-name" }), "Bob");
    await user.type(screen.getByLabelText("Room code"), "bad");
    await user.click(screen.getByRole("button", { name: "Join room" }));

    expect(screen.getByRole("alert")).toHaveTextContent("ABC-123-XYZ");
    expect(sessionsApi.join).not.toHaveBeenCalled();
  });

  it("turns a credential-free deep link into a prefilled join flow", async () => {
    const user = userEvent.setup();
    sessionsApi.join.mockResolvedValue({
      participant_token: "joined-capability",
      session: baseSession,
    });
    renderRoom();

    expect(screen.getByText("Room ABC-123-XYZ")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your name"), "Alice");
    await user.click(screen.getByRole("button", { name: "Join room" }));

    expect(await screen.findByRole("heading", { name: "Sprint planning" })).toBeInTheDocument();
    expect(sessionsApi.join).toHaveBeenCalledWith("Alice", "ABC-123-XYZ");
    expect(getSessionToken("ABC-123-XYZ")).toBe("joined-capability");
  });

  it("uses the server response as the authoritative vote state", async () => {
    const user = userEvent.setup();
    const votedSession = {
      ...baseSession,
      updated_at: "2026-07-05T08:00:01Z",
      votes: {
        alice: {
          vote: 5,
          is_spectator: false,
          has_voted: true,
        },
      },
    };
    saveSessionToken("ABC-123-XYZ", "creator-capability");
    sessionsApi.castVote.mockResolvedValue({ session: votedSession });
    renderRoom();

    const card = await screen.findByRole("button", { name: "5 points" });
    await user.click(card);

    await waitFor(() => expect(card).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "Reveal cards" })).toBeEnabled();
    expect(sessionsApi.castVote).toHaveBeenCalledWith(
      "ABC-123-XYZ",
      5,
      "creator-capability",
    );
  });
});
