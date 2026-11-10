import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginGoogleSignIn,
  clearGoogleSignInAttempt,
  clearLastLoginMethod,
  completeGoogleSignIn,
  wasGoogleLastUsed,
} from "./last-login-method";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("last login method", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createStorage(),
      sessionStorage: createStorage(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("remembers Google only after an attempted sign-in returns authenticated", () => {
    completeGoogleSignIn(true);
    expect(wasGoogleLastUsed()).toBe(false);

    beginGoogleSignIn();
    completeGoogleSignIn(false);
    expect(wasGoogleLastUsed()).toBe(false);

    beginGoogleSignIn();
    completeGoogleSignIn(true);
    expect(wasGoogleLastUsed()).toBe(true);
  });

  it("clears a cancelled attempt and hides the pill after email authentication", () => {
    beginGoogleSignIn();
    clearGoogleSignInAttempt();
    completeGoogleSignIn(true);
    expect(wasGoogleLastUsed()).toBe(false);

    beginGoogleSignIn();
    completeGoogleSignIn(true);
    clearLastLoginMethod();
    expect(wasGoogleLastUsed()).toBe(false);
  });
});
