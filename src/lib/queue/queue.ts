export type QueueStatus = "waiting" | "called" | "seated" | "skipped" | "cancelled";
export type Actor = { role: "guest" | "staff"; userId: string };

export interface QueueEntry {
  id: string;
  restaurantId: string;
  guestId: string;
  partySize: number;
  /** ISO date (YYYY-MM-DD) in the restaurant's time zone. */
  serviceDay: string;
  /** Unique per (restaurant, service day); the only ordering key. */
  number: number;
  status: QueueStatus;
  joinedAt: Date;
  statusChangedAt: Date;
}

export type QueueError = { code: "invalid_party_size" };

export type Result<T> = { ok: true; value: T } | { ok: false; error: QueueError };

const MIN_PARTY = 1;
const MAX_PARTY = 20;

export function validatePartySize(input: unknown): Result<number> {
  if (
    typeof input === "number" &&
    Number.isInteger(input) &&
    input >= MIN_PARTY &&
    input <= MAX_PARTY
  ) {
    return { ok: true, value: input };
  }
  return { ok: false, error: { code: "invalid_party_size" } };
}

/**
 * Next queue number for a service day: the day's highest number (any status) + 1, so a cancelled
 * number is never reused. The database's per-day counter row is the source of truth under
 * concurrency (plan §2.3); this is the rule it implements.
 */
export function nextQueueNumber(
  entries: QueueEntry[],
  serviceDay: string,
  restaurantId?: string,
): number {
  let highest = 0;
  for (const e of entries) {
    if (e.serviceDay !== serviceDay) continue;
    if (restaurantId !== undefined && e.restaurantId !== restaurantId) continue;
    highest = Math.max(highest, e.number);
  }
  return highest + 1;
}
