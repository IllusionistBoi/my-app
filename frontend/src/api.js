const DEFAULT_API_BASE = "/api";
const DEFAULT_TIMEOUT_MS = 10_000;
const PRODUCTION_HOST = "my-app-tau-seven-25.vercel.app";

function configuredApiBase() {
  return (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function assertSafePreviewTarget(apiBase) {
  if (
    apiBase === DEFAULT_API_BASE &&
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".vercel.app") &&
    window.location.hostname !== PRODUCTION_HOST
  ) {
    throw new ApiError(
      "This preview is intentionally disconnected from production data. Configure VITE_API_URL with an isolated staging backend.",
      {
        code: "preview_backend_not_configured",
        status: 503,
      },
    );
  }
}

export class ApiError extends Error {
  constructor(message, { code = "request_failed", status = 0, details, requestId } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

function requestUrl(path) {
  const apiBase = configuredApiBase();
  assertSafePreviewTarget(apiBase);
  return `${apiBase}/${path.replace(/^\/+/, "")}`;
}

export async function request(
  path,
  {
    method = "GET",
    body,
    token,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);

  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(requestUrl(path), {
      method,
      cache: method === "GET" ? "no-store" : undefined,
      credentials: "omit",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let payload = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new ApiError("The server returned an unreadable response.", {
          code: "invalid_server_response",
          status: response.status,
          requestId: response.headers.get("X-Request-ID"),
        });
      }
    }

    if (!response.ok) {
      const error = payload?.error;
      throw new ApiError(error?.message || "The request could not be completed.", {
        code: error?.code || `http_${response.status}`,
        status: response.status,
        details: error?.details,
        requestId: error?.request_id || response.headers.get("X-Request-ID"),
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (timedOut) {
      throw new ApiError("The server took too long to respond. Please try again.", {
        code: "request_timeout",
        status: 408,
      });
    }
    if (signal?.aborted) {
      throw new ApiError("Request cancelled.", {
        code: "request_cancelled",
      });
    }
    throw new ApiError("The server is currently unreachable. Check your connection and try again.", {
      code: "network_error",
    });
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export const sessionsApi = {
  create(username, sessionName, options) {
    return request("sessions/create/", {
      ...options,
      method: "POST",
      body: { username, session_name: sessionName },
    });
  },

  join(username, sessionId, options) {
    return request("sessions/join/", {
      ...options,
      method: "POST",
      body: { username, sessionId },
    });
  },

  details(sessionId, token, options) {
    return request(`sessions/${sessionId}/details/`, {
      ...options,
      token,
    });
  },

  castVote(sessionId, vote, token, options) {
    return request(`sessions/${sessionId}/cast_vote/`, {
      ...options,
      method: "POST",
      body: { vote },
      token,
    });
  },

  clearVote(sessionId, token, options) {
    return request(`sessions/${sessionId}/clear_vote/`, {
      ...options,
      method: "POST",
      body: {},
      token,
    });
  },

  setSpectator(sessionId, isSpectator, token, options) {
    return request(`sessions/${sessionId}/make_spectator/`, {
      ...options,
      method: "POST",
      body: { is_spectator: isSpectator },
      token,
    });
  },

  reveal(sessionId, token, options) {
    return request(`sessions/${sessionId}/flip_votes/`, {
      ...options,
      method: "POST",
      body: {},
      token,
    });
  },

  reset(sessionId, token, options) {
    return request(`sessions/${sessionId}/reset_votes/`, {
      ...options,
      method: "POST",
      body: {},
      token,
    });
  },

  removeParticipant(sessionId, username, token, options) {
    return request(`sessions/${sessionId}/remove_user/`, {
      ...options,
      method: "POST",
      body: { username },
      token,
    });
  },

  deleteSession(sessionId, token, options) {
    return request(`sessions/${sessionId}/delete_session/`, {
      ...options,
      method: "DELETE",
      token,
    });
  },
};
