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

  it.todo(
    "After 5 failed sign-ins for the same email within 15 minutes, further attempts for that email fail for 15 minutes, even with the correct password.",
  );
});
