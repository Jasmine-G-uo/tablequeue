import { describe, expect, it, vi } from "vitest";
import { buildAuthConfig, sessionCallback, jwtCallback, signOutToSignIn } from "./config";

const EIGHT_HOURS = 8 * 60 * 60;
const fakeDb = { query: vi.fn() };

// Acceptance criteria from issue #2 (US-01).
describe("session configuration", () => {
  it("Sessions expire after at most 8 hours.", () => {
    const config = buildAuthConfig({ db: fakeDb, nodeEnv: "development" });
    expect(config.session?.strategy).toBe("jwt");
    expect(config.session?.maxAge).toBeLessThanOrEqual(EIGHT_HOURS);
    expect(config.jwt?.maxAge).toBeLessThanOrEqual(EIGHT_HOURS);
  });

  describe("Session cookies are HttpOnly, SameSite=Lax, and Secure in production.", () => {
    it("is HttpOnly and SameSite=Lax in every environment", () => {
      for (const nodeEnv of ["development", "test", "production"] as const) {
        const options = buildAuthConfig({ db: fakeDb, nodeEnv }).cookies?.sessionToken?.options;
        expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
      }
    });

    it("is Secure (with the __Secure- prefix) only in production", () => {
      const prod = buildAuthConfig({ db: fakeDb, nodeEnv: "production" }).cookies?.sessionToken;
      const dev = buildAuthConfig({ db: fakeDb, nodeEnv: "development" }).cookies?.sessionToken;
      expect(prod?.options?.secure).toBe(true);
      expect(prod?.name).toMatch(/^__Secure-/);
      expect(dev?.options?.secure).toBe(false);
    });
  });

  it("Sign-out clears the session and returns the user to sign-in.", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    await signOutToSignIn(signOut);
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in" });
  });

  it("carries the user id and role from sign-in into the session, and nothing else", () => {
    const token = jwtCallback({
      token: { sub: undefined },
      user: { id: "11111111-1111-4111-8111-111111111111", role: "guest", email: "a@b.co" },
    });
    expect(token).toMatchObject({ sub: "11111111-1111-4111-8111-111111111111", role: "guest" });

    const session = sessionCallback({
      session: { user: { email: "a@b.co" }, expires: "2026-11-21T02:00:00Z" },
      token,
    });
    expect(session.user).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      role: "guest",
      email: "a@b.co",
    });
  });

  it("uses our own sign-in page", () => {
    expect(buildAuthConfig({ db: fakeDb, nodeEnv: "test" }).pages?.signIn).toBe("/sign-in");
  });
});
