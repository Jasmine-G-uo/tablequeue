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
  | { code: "invalid_party_size" }
  | { code: "already_in_queue"; entry: QueueEntry }
  | { code: "invalid_transition"; from: QueueStatus; to: QueueStatus }
  | { code: "queue_empty" };

export type Result<T> = { ok: true; value: T } | { ok: false; error: QueueError };

/** Statuses that still hold a place in the queue. */
const OPEN_STATUSES: ReadonlySet<QueueStatus> = new Set(["waiting", "called"]);

function isOpen(entry: QueueEntry): boolean {
  return OPEN_STATUSES.has(entry.status);
}

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
  const existing = entries.find((e) => e.guestId === guestId && isOpen(e));
  if (existing) return { ok: false, error: { code: "already_in_queue", entry: existing } };
  void serviceDay;
  return { ok: true, value: undefined };
}

/** Today's waiting and called entries in queue-number order: the staff list (PRD US-05). */
export function activeQueue(entries: QueueEntry[], serviceDay: string): QueueEntry[] {
  return entries
    .filter((e) => e.serviceDay === serviceDay && isOpen(e))
    .sort((a, b) => a.number - b.number);
}

/**
 * Waiting entries ahead of `entryId` (PRD §4.3), derived from the same list staff see so the two
 * views cannot disagree. Null when the entry is not an active waiting entry.
 */
export function partiesAhead(
  entries: QueueEntry[],
  entryId: string,
  serviceDay: string,
): number | null {
  const waiting = activeQueue(entries, serviceDay).filter((e) => e.status === "waiting");
  const index = waiting.findIndex((e) => e.id === entryId);
  return index === -1 ? null : index;
}

/** The status table (PRD §4.2): every allowed change; seated, skipped and cancelled are final. */
const NEXT_STATUSES: Readonly<Record<QueueStatus, readonly QueueStatus[]>> = {
  waiting: ["called", "cancelled"],
  called: ["seated", "skipped", "cancelled"],
  seated: [],
  skipped: [],
  cancelled: [],
};

/** Moves an entry to a new status, returning a new object (never mutating the input). */
export function transition(
  entry: QueueEntry,
  to: QueueStatus,
  actor: Actor,
  now: Date,
  serviceDay: string,
): Result<QueueEntry> {
  void actor;
  void serviceDay;
  if (!NEXT_STATUSES[entry.status].includes(to)) {
    return { ok: false, error: { code: "invalid_transition", from: entry.status, to } };
  }
  return { ok: true, value: { ...entry, status: to, statusChangedAt: now } };
}

/** Staff "Call next": the lowest-numbered waiting entry of the day becomes called (PRD US-05). */
export function callNext(
  entries: QueueEntry[],
  actor: Actor,
  now: Date,
  serviceDay: string,
): Result<QueueEntry> {
  const next = activeQueue(entries, serviceDay).find((e) => e.status === "waiting");
  if (!next) return { ok: false, error: { code: "queue_empty" } };
  return transition(next, "called", actor, now, serviceDay);
}
