import type { Queryable } from "@/lib/db/pool";
import { hashPassword } from "./password";
import { authFailure, normalizeEmail, validateRegistration, type AuthResult } from "./validation";

export type Role = "guest" | "staff";

export interface User {
  id: string;
  email: string;
  role: Role;
}

export interface StoredUser extends User {
  passwordHash: string;
}

const UNIQUE_VIOLATION = "23505";

/** Self-registration always creates a guest (PRD §2); staff accounts come from the seed script. */
export async function registerGuest(
  db: Queryable,
  input: { email: unknown; password: unknown },
): Promise<AuthResult<User>> {
  const valid = validateRegistration(input);
  if (!valid.ok) return valid;

  const passwordHash = await hashPassword(valid.value.password);
  try {
    const { rows } = await db.query<User>(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'guest')
       RETURNING id, email, role`,
      [valid.value.email, passwordHash],
    );
    return { ok: true, value: rows[0] };
  } catch (error) {
    if (isUniqueViolation(error)) return authFailure("email_taken");
    throw error;
  }
}

export async function findUserByEmail(db: Queryable, email: string): Promise<StoredUser | null> {
  const { rows } = await db.query<StoredUser>(
    `SELECT id, email, role, password_hash AS "passwordHash" FROM users WHERE lower(email) = $1`,
    [normalizeEmail(email)],
  );
  return rows[0] ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION
  );
}
