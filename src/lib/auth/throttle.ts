import type { Queryable } from "@/lib/db/pool";

export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;

/**
 * An email is locked while it has MAX_FAILURES or more failed attempts in the last
 * WINDOW_MINUTES that came after its most recent successful sign-in (PRD US-01, OWASP A07).
 */
export async function isLocked(db: Queryable, email: string, now: Date): Promise<boolean> {
  const { rows } = await db.query<{ failures: number }>(
    `SELECT count(*)::int AS failures
       FROM login_attempts
      WHERE email = $1
        AND NOT succeeded
        AND attempted_at > $2::timestamptz - make_interval(mins => $3)
        AND attempted_at > COALESCE(
              (SELECT max(attempted_at) FROM login_attempts WHERE email = $1 AND succeeded),
              '-infinity')`,
    [email, now, WINDOW_MINUTES],
  );
  return rows[0].failures >= MAX_FAILURES;
}

export async function recordAttempt(
  db: Queryable,
  email: string,
  succeeded: boolean,
  now: Date,
): Promise<void> {
  await db.query(
    "INSERT INTO login_attempts (email, succeeded, attempted_at) VALUES ($1, $2, $3)",
    [email, succeeded, now],
  );
}
