import type { Queryable } from "@/lib/db/pool";
import { verifyPassword } from "./password";
import { findUserByEmail, type User } from "./users";
import { authFailure, type AuthResult } from "./validation";

/**
 * Checks credentials and returns the user, or `invalid_credentials` for every kind of failure so
 * the response never reveals whether an email is registered (PRD US-01).
 */
export async function authenticate(
  db: Queryable,
  input: { email: unknown; password: unknown },
): Promise<AuthResult<User>> {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return authFailure("invalid_credentials");
  }

  const user = await findUserByEmail(db, input.email);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    return authFailure("invalid_credentials");
  }

  return { ok: true, value: { id: user.id, email: user.email, role: user.role } };
}
