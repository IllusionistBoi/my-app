import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, request, sessionsApi } from "../api.js";

function jsonResponse(payload, { status = 200, requestId = "request-123" } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
  });
}

describe("API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends the scoped participant capability and JSON body", async () => {
    fetch.mockResolvedValue(jsonResponse({ session: { session_id: "ABC-123-XYZ" } }));

    await sessionsApi.castVote("ABC-123-XYZ", 8, "secret-capability");

    expect(fetch).toHaveBeenCalledWith(
      "/api/sessions/ABC-123-XYZ/cast_vote/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ vote: 8 }),
        credentials: "omit",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-capability",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("surfaces the server error code and request ID", async () => {
    fetch.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "votes_incomplete",
            message: "Every participant must vote.",
            request_id: "backend-request",
          },
        },
        { status: 409 },
      ),
    );

    await expect(request("sessions/ABC-123-XYZ/flip_votes/")).rejects.toMatchObject({
      name: "ApiError",
      code: "votes_incomplete",
      message: "Every participant must vote.",
      requestId: "backend-request",
      status: 409,
    });
  });

  it("turns stalled requests into a clear timeout", async () => {
    vi.useFakeTimers();
    fetch.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const pending = request("health/", { timeoutMs: 50 });
    const assertion = expect(pending).rejects.toEqual(
      expect.objectContaining({
        code: "request_timeout",
        status: 408,
      }),
    );
    await vi.advanceTimersByTimeAsync(50);

    await assertion;
  });

  it("uses a typed error for unreachable servers", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(request("health/")).rejects.toBeInstanceOf(ApiError);
    await expect(request("health/")).rejects.toMatchObject({
      code: "network_error",
    });
  });
});
