import type { Queryable } from "@/lib/db/pool";
import { verifyPassword } from "./password";
import { isLocked, recordAttempt } from "./throttle";
import { findUserByEmail, type User } from "./users";
import { authFailure, normalizeEmail, type AuthResult } from "./validation";

/**
 * Checks credentials and returns the user, or `invalid_credentials` for every kind of failure so
 * the response never reveals whether an email is registered or locked (PRD US-01).
 * `now` is injectable so throttling can be tested without waiting.
 */
export async function authenticate(
  db: Queryable,
  input: { email: unknown; password: unknown },
  now: Date = new Date(),
): Promise<AuthResult<User>> {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return authFailure("invalid_credentials");
  }

  const email = normalizeEmail(input.email);
  // Locked attempts are not recorded, so the lock lasts the window and is not extended.
  if (await isLocked(db, email, now)) return authFailure("invalid_credentials");

  const user = await findUserByEmail(db, email);
  const valid = user !== null && (await verifyPassword(input.password, user.passwordHash));
  await recordAttempt(db, email, valid, now);
  if (!valid) return authFailure("invalid_credentials");

  return { ok: true, value: { id: user.id, email: user.email, role: user.role } };
}
