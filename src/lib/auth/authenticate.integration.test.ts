import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPool, truncate } from "../../../test/db";
import { authenticate } from "./authenticate";
import { registerGuest } from "./users";

const pool = createTestPool();
const INVALID = { ok: false, error: { code: "invalid_credentials" } };

beforeEach(async () => {
  await truncate(pool, ["users", "login_attempts"]);
  await registerGuest(pool, { email: "ann@example.com", password: "correct-horse" });
});
afterAll(() => pool.end());

// Acceptance criteria from issue #2 (US-01).
describe("sign-in (PostgreSQL)", () => {
  describe("Sign-in succeeds with correct credentials and fails with the single code `invalid_credentials` for both a wrong password and an unknown email.", () => {
    it("returns the user for correct credentials, with the email in any case", async () => {
      const result = await authenticate(pool, {
        email: " ANN@example.com",
        password: "correct-horse",
      });
      expect(result).toMatchObject({
        ok: true,
        value: { email: "ann@example.com", role: "guest" },
      });
    });

    it("returns invalid_credentials for a wrong password", async () => {
      expect(
        await authenticate(pool, { email: "ann@example.com", password: "wrong-horse" }),
      ).toEqual(INVALID);
    });

    it("returns the same invalid_credentials for an unknown email", async () => {
      expect(
        await authenticate(pool, { email: "nobody@example.com", password: "correct-horse" }),
      ).toEqual(INVALID);
    });

    it("returns invalid_credentials for non-string input instead of throwing", async () => {
      expect(await authenticate(pool, { email: undefined, password: 123 })).toEqual(INVALID);
    });
  });

  describe("After 5 failed sign-ins for the same email within 15 minutes, further attempts for that email fail for 15 minutes, even with the correct password.", () => {
    const t0 = new Date("2026-11-20T18:00:00Z");
    const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
    const wrong = { email: "ann@example.com", password: "wrong-horse" };
    const right = { email: "ann@example.com", password: "correct-horse" };

    async function failFiveTimes() {
      for (let i = 0; i < 5; i++) await authenticate(pool, wrong, at(i));
    }

    it("refuses the correct password while locked, with the same generic error", async () => {
      await failFiveTimes();
      expect(await authenticate(pool, right, at(5))).toEqual(INVALID);
      expect(await authenticate(pool, right, at(14))).toEqual(INVALID);
    });

    it("allows sign-in again once the 15-minute window has passed", async () => {
      await failFiveTimes();
      expect((await authenticate(pool, right, at(20))).ok).toBe(true);
    });

    it("does not lock after only 4 failures", async () => {
      for (let i = 0; i < 4; i++) await authenticate(pool, wrong, at(i));
      expect((await authenticate(pool, right, at(5))).ok).toBe(true);
    });

    it("does not count failures older than 15 minutes", async () => {
      await failFiveTimes();
      // Failures at minutes 0-4 have all aged out by minute 20; three new ones are not enough.
      for (let i = 0; i < 3; i++) await authenticate(pool, wrong, at(20 + i));
      expect((await authenticate(pool, right, at(23))).ok).toBe(true);
    });

    it("a successful sign-in resets the count", async () => {
      for (let i = 0; i < 4; i++) await authenticate(pool, wrong, at(i));
      expect((await authenticate(pool, right, at(4))).ok).toBe(true);
      await authenticate(pool, wrong, at(5));
      expect((await authenticate(pool, right, at(6))).ok).toBe(true);
    });

    it("locks per email, not globally", async () => {
      await registerGuest(pool, { email: "bob@example.com", password: "correct-horse" });
      await failFiveTimes();
      const bob = { email: "bob@example.com", password: "correct-horse" };
      expect((await authenticate(pool, bob, at(5))).ok).toBe(true);
    });
  });
});
