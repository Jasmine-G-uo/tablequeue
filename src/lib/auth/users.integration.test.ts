import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPool, truncate } from "../../../test/db";
import { findUserByEmail, registerGuest } from "./users";

const pool = createTestPool();

beforeEach(() => truncate(pool, ["users"]));
afterAll(() => pool.end());

// Acceptance criteria from issue #2 (US-01).
describe("guest registration (PostgreSQL)", () => {
  it("A visitor can register with an email and a password; the new account has the guest role.", async () => {
    const result = await registerGuest(pool, {
      email: "Ann@Example.com",
      password: "correct-horse",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ email: "ann@example.com", role: "guest" });
    expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/);

    const stored = await findUserByEmail(pool, "ann@example.com");
    expect(stored?.role).toBe("guest");
    expect(stored?.passwordHash).not.toBe("correct-horse");
  });

  it("Registration rejects an already-registered email (`email_taken`).", async () => {
    await registerGuest(pool, { email: "ann@example.com", password: "correct-horse" });

    const again = await registerGuest(pool, { email: " ANN@example.com", password: "other-pass1" });

    expect(again).toEqual({ ok: false, error: { code: "email_taken" } });
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM users");
    expect(rows[0].n).toBe(1);
  });

  it("rejects invalid input before touching the database", async () => {
    expect(await registerGuest(pool, { email: "not-an-email", password: "correct-horse" })).toEqual(
      { ok: false, error: { code: "invalid_email" } },
    );
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM users");
    expect(rows[0].n).toBe(0);
  });

  it("finds a user by email regardless of case or surrounding spaces", async () => {
    await registerGuest(pool, { email: "ann@example.com", password: "correct-horse" });
    expect((await findUserByEmail(pool, "  ANN@EXAMPLE.COM "))?.email).toBe("ann@example.com");
    expect(await findUserByEmail(pool, "nobody@example.com")).toBeNull();
  });
});
