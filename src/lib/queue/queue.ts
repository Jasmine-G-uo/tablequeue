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

export type QueueError =
  { code: "invalid_party_size" } | { code: "already_in_queue"; entry: QueueEntry };

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

/** A guest may hold at most one waiting or called entry (PRD §4.1). */
export function canJoin(entries: QueueEntry[], guestId: string, serviceDay: string): Result<void> {
  const existing = entries.find(
    (e) => e.guestId === guestId && (e.status === "waiting" || e.status === "called"),
  );
  if (existing) return { ok: false, error: { code: "already_in_queue", entry: existing } };
  void serviceDay;
  return { ok: true, value: undefined };
}

/** Today's waiting and called entries in queue-number order: the staff list (PRD US-05). */
export function activeQueue(entries: QueueEntry[], serviceDay: string): QueueEntry[] {
  return entries
    .filter((e) => e.serviceDay === serviceDay && (e.status === "waiting" || e.status === "called"))
    .sort((a, b) => a.number - b.number);
}
