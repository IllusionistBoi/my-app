import { beforeEach, describe, expect, it } from "vitest";

import {
  getSessionToken,
  isValidSessionId,
  normalizeSessionId,
  removeSessionToken,
  saveSessionToken,
} from "../sessionStore.js";

describe("session capability storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("normalizes and validates room codes", () => {
    expect(normalizeSessionId(" abc-123-xyz ")).toBe("ABC-123-XYZ");
    expect(isValidSessionId("abc-123-xyz")).toBe(true);
    expect(isValidSessionId("../not-a-room")).toBe(false);
  });

  it("keeps capabilities scoped to one room and revokes them independently", () => {
    saveSessionToken("ABC-123-XYZ", "first");
    saveSessionToken("DEF-456-UVW", "second");

    expect(getSessionToken("ABC-123-XYZ")).toBe("first");
    expect(getSessionToken("DEF-456-UVW")).toBe("second");

    removeSessionToken("ABC-123-XYZ");
    expect(getSessionToken("ABC-123-XYZ")).toBeNull();
    expect(getSessionToken("DEF-456-UVW")).toBe("second");
  });
});
