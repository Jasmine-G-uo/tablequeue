import type { Queryable } from "@/lib/db/pool";

export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;

/**
 * An email is locked for WINDOW_MINUTES after the failure that brings it to MAX_FAILURES failures
 * within WINDOW_MINUTES (PRD US-01, OWASP A07). Only failures after the most recent successful
 * sign-in count. Locked attempts are not recorded, so they neither extend nor renew the lock.
 */
export async function isLocked(db: Queryable, email: string, now: Date): Promise<boolean> {
  const { rows } = await db.query<{ locked: boolean }>(
    `WITH failures AS (
       SELECT attempted_at
         FROM login_attempts
        WHERE email = $1
          AND NOT succeeded
          AND attempted_at > COALESCE(
                (SELECT max(attempted_at) FROM login_attempts WHERE email = $1 AND succeeded),
                '-infinity')
     )
     SELECT EXISTS (
       SELECT 1
         FROM failures candidate
        WHERE candidate.attempted_at > $2::timestamptz - make_interval(mins => $3)
          AND (SELECT count(*)
                 FROM failures f
                WHERE f.attempted_at <= candidate.attempted_at
                  AND f.attempted_at > candidate.attempted_at - make_interval(mins => $3)
              ) >= $4
     ) AS locked`,
    [email, now, WINDOW_MINUTES, MAX_FAILURES],
  );
  return rows[0].locked;
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
