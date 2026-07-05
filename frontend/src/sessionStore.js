const TOKEN_PREFIX = "planning-poker.capability.v1.";
const SESSION_ID_PATTERN = /^[A-Z0-9]{3}(?:-[A-Z0-9]{3}){2}$/;

export function normalizeSessionId(value) {
  return String(value || "").trim().toUpperCase();
}

export function isValidSessionId(value) {
  return SESSION_ID_PATTERN.test(normalizeSessionId(value));
}

function storageKey(sessionId) {
  return `${TOKEN_PREFIX}${normalizeSessionId(sessionId)}`;
}

export function getSessionToken(sessionId) {
  if (!isValidSessionId(sessionId)) {
    return null;
  }
  try {
    return window.sessionStorage.getItem(storageKey(sessionId));
  } catch {
    return null;
  }
}

export function saveSessionToken(sessionId, token) {
  if (!isValidSessionId(sessionId) || !token) {
    throw new Error("A valid room code and participant capability are required.");
  }
  window.sessionStorage.setItem(storageKey(sessionId), token);
}

export function removeSessionToken(sessionId) {
  if (!isValidSessionId(sessionId)) {
    return;
  }
  try {
    window.sessionStorage.removeItem(storageKey(sessionId));
  } catch {
    // Storage can be unavailable in locked-down browsers; there is nothing else to clear.
  }
}
