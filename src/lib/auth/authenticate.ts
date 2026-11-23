import { withTransaction, type Database } from "@/lib/db/pool";
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
  db: Database,
  input: { email: unknown; password: unknown },
  now: Date = new Date(),
): Promise<AuthResult<User>> {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return authFailure("invalid_credentials");
  }

  const email = normalizeEmail(input.email);
  const password = input.password;
  return withTransaction(db, async (tx): Promise<AuthResult<User>> => {
    // One sign-in per email at a time: without this, parallel requests all pass the lock check
    // before any failure is recorded and can test unlimited passwords (OWASP A07).
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);

    // Locked attempts are not recorded, so the lock lasts the window and is not extended.
    if (await isLocked(tx, email, now)) return authFailure("invalid_credentials");

    const user = await findUserByEmail(tx, email);
    const valid = user !== null && (await verifyPassword(password, user.passwordHash));
    await recordAttempt(tx, email, valid, now);
    if (!valid) return authFailure("invalid_credentials");

    return { ok: true, value: { id: user.id, email: user.email, role: user.role } };
  });
}
