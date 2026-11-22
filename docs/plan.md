# TableQueue — Architecture and Delivery Plan

- Status: v3 (Sprint 1) — v2 revised after [independent review](reviews/plan-review.md); v3 settles the queue-domain interface (#3)
- Spec: [PRD.md](PRD.md)
- Last updated: 2026-11-20

## 1. Approach

A single Next.js (App Router) application deployed on Vercel, backed by PostgreSQL. Business rules
live in a **pure TypeScript domain module** with no I/O, so they can be built test-first and reused
by both the guest and staff sides. Everything that touches the database, the session, or the
network is a thin layer around that core.

Alternatives considered:

| Option                                        | Trade-off                                                        | Decision                                         |
| --------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| Rules inside route handlers / server actions  | Fastest to start; rules get duplicated and are hard to unit-test | Rejected                                         |
| Rules in SQL (constraints + stored functions) | Strong consistency; hard to TDD and to review                    | Partly used: uniqueness and compare-and-set only |
| Pure domain module + thin persistence layer   | Fast unit tests, one source of truth, DB used for atomicity      | **Chosen**                                       |

## 2. Modules

Each module can be developed and tested on its own branch. Arrows show "depends on".

```
guest-ui ─┐                ┌─▶ queue-domain (pure, no imports from other modules)
          ├─▶ queue-service┤
staff-ui ─┘        │       └─▶ db
                   └──────────▶ auth ──▶ db
```

| Module            | Location                           | Responsibility                                                                                              | Tests                       |
| ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| **db**            | `src/lib/db/`, `db/migrations/`    | Connection pool, migrations (`npm run db:migrate`), staff seed script                                       | integration                 |
| **auth**          | `src/lib/auth/`, `src/app/(auth)/` | Registration, sign-in/out (Auth.js Credentials), hashing, throttling, `requireGuest` / `requireStaff`       | unit + integration          |
| **queue-domain**  | `src/lib/queue/`                   | Pure rules: service day, numbering, ordering, parties ahead, call-next selection, state machine, validation | unit (TDD)                  |
| **queue-service** | `src/lib/queue-service/`           | Transactions, compare-and-set transitions, ownership from the session, maps session → domain `Actor`        | integration (real Postgres) |
| **guest-ui**      | `src/app/(guest)/`                 | Join form, status page with 10 s refresh, cancel button                                                     | component + E2E             |
| **staff-ui**      | `src/app/staff/`                   | Queue list, call next, seat, skip                                                                           | component + E2E             |

### 2.1 Shared conventions (agreed in #1 so #2 and #3 stay independent)

- User ids are **string UUIDs**; role literals are exactly `"guest" | "staff"`.
- queue-domain defines its **own** structural `Actor` type and never imports from auth. The
  queue-service maps the Auth.js session onto it.
- Times are `Date`; the service day is an ISO date string (`"2026-11-20"`).
- Coverage thresholds in `vitest.config.mts` are one line per module glob, so branches merge
  without conflicts.

### 2.2 queue-domain interface (settled in #3)

The draft in v2 was settled test-first in #3; this is the implemented shape
(`src/lib/queue/queue.ts`). Changes from the draft are listed in
[plans/3-queue-domain.md](plans/3-queue-domain.md).

```ts
type QueueStatus = "waiting" | "called" | "seated" | "skipped" | "cancelled";
type Actor = { role: "guest" | "staff"; userId: string };

interface QueueEntry {
  id: string;
  restaurantId: string;
  guestId: string;
  partySize: number;
  serviceDay: string; // ISO date in the restaurant's time zone
  number: number; // unique per (restaurant, serviceDay), starts at 1
  status: QueueStatus;
  joinedAt: Date;
  statusChangedAt: Date;
}

type QueueError =
  | { code: "invalid_party_size" }
  | { code: "already_in_queue"; entry: QueueEntry }
  | { code: "invalid_transition"; from: QueueStatus; to: QueueStatus }
  | { code: "not_found" }
  | { code: "forbidden" }
  | { code: "queue_empty" };
type Result<T> = { ok: true; value: T } | { ok: false; error: QueueError };

validatePartySize(input: unknown): Result<number>;
nextQueueNumber(entries: QueueEntry[], serviceDay: string, restaurantId?: string): number; // max(number of that day, any status) + 1
canJoin(entries: QueueEntry[], guestId: string, serviceDay: string): Result<void>;
activeQueue(entries: QueueEntry[], serviceDay: string): QueueEntry[]; // waiting+called, by number
partiesAhead(entries: QueueEntry[], entryId: string, serviceDay: string): number | null;
callNext(entries: QueueEntry[], actor: Actor, now: Date, serviceDay: string): Result<QueueEntry>;
transition(entry: QueueEntry, to: QueueStatus, actor: Actor, now: Date, serviceDay: string): Result<QueueEntry>;
```

- The list-based functions filter by service day **inside** the domain, so the midnight boundary
  and leftover entries (PRD §4.1) are unit-tested there.
- Ordering is always by `number`, never by `joinedAt`.
- `activeQueue` feeds both the staff list and `partiesAhead`, so the two views cannot disagree.
- `partiesAhead` returns `null` for any entry that is not active and `waiting`.
- An entry is active (internal `isActive`) when it is `waiting`/`called` on the given service day.
- `transition` checks in this order: role (`forbidden`), ownership for guests (`not_found`), then
  expiry and the status table (`invalid_transition`), so a refusal never reveals another guest's
  entry.
- `serviceDayFor(now, timeZone)` moved to queue-service: no #3 criterion needs it, and it is the
  only function that reads a time zone. Its midnight, UTC-vs-local, and DST tests are criteria of
  #9.
- Callers pass one restaurant's entries (AD-2). Only `nextQueueNumber` takes an optional
  `restaurantId`, because only its criterion names the restaurant ("unique per restaurant and
  service day"); the other list functions do not filter by restaurant.

### 2.3 Consistency rules (queue-service)

- **Numbering:** a per-day counter row keyed by a primary key on `(restaurant_id, service_day)`,
  `INSERT INTO queue_counters (restaurant_id, service_day, last_number) VALUES (…, 1)
ON CONFLICT (restaurant_id, service_day) DO UPDATE SET last_number = queue_counters.last_number + 1
RETURNING last_number`, so the first join of a day is serialized too. A unique index on
  `(restaurant_id, service_day, number)` is the backstop.
- **One active entry:** a partial unique index on `(restaurant_id, guest_id, service_day)
WHERE status IN ('waiting','called')`. A violation (`23505`) maps to `already_in_queue`, never a 500.
- **Every transition** (call, seat, skip, cancel) is a compare-and-set:
  `UPDATE … SET status = $to WHERE id = $id AND status = $from RETURNING *`. Zero rows → `conflict`.
- **Call next:** `SELECT … WHERE status = 'waiting' AND service_day = $today ORDER BY number
LIMIT 1 FOR UPDATE SKIP LOCKED`, then the compare-and-set above, in one transaction. A
  concurrent caller skips the locked row and takes the next one.
- **Ownership:** guest actions look up the entry by `guest_id = session.userId`; a client-supplied
  id is never trusted.
- **Driver:** the database client must support interactive transactions (a `pg` pool or Neon's
  WebSocket `Pool`, not the HTTP `neon()` driver).

### 2.4 Test setup

| Project       | Environment                                     | What runs there                                            |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `unit`        | node (component tests opt in to jsdom per file) | domain, auth helpers, components                           |
| `integration` | node, real PostgreSQL                           | migrations, auth flows, queue-service including race tests |

- Integration tests use a `globalSetup` that migrates a throwaway database (added in #2).
- Race tests open two pooled connections and fire both requests with `Promise.all`.
- CI runs integration tests against a `postgres:17` service container (#1).
- queue-domain gates at ≥70% coverage (course minimum) and aims for ~90% branches, with a table
  test over every status × target × role combination.

## 3. Delivery

### 3.1 Sprint 1 (HW4 scope)

| Issue | Title                                                       | Module(s)    | Branch                   | Depends on |
| ----- | ----------------------------------------------------------- | ------------ | ------------------------ | ---------- |
| #1    | Set up project spec, Claude Code rules, permissions, and CI | —            | `chore/1-project-setup`  | —          |
| #2    | Guest registration and sign-in                              | db, auth     | `feature/2-auth`         | #1         |
| #3    | Queue domain logic (TDD)                                    | queue-domain | `feature/3-queue-domain` | #1         |
| #4    | HW4 session log and reflection                              | docs         | `docs/4-hw4-reflection`  | #1         |

#2 and #3 share only the conventions in §2.1 and can be developed in parallel.

### 3.2 Backlog (later P3 sprints)

- Queue persistence and API (queue-service) — US-02..US-06 server side, including race tests.
- Guest join/status/cancel pages — US-02..US-04.
- Staff queue page — US-05, US-06.
- Staff seed script and role-based protection end to end.
- Playwright E2E for the guest and staff happy paths.
- Vercel preview and production deploys, AI PR review, security scanning gates.

## 4. Risks

| Risk                                                                      | Mitigation                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16 / Auth.js APIs differ from older docs (`middleware` → `proxy`) | Read `node_modules/next/dist/docs/` and installed types first; enforce roles in every server action / route handler, not only in `proxy`                                                                 |
| Auth.js compatibility with Next 16 unproven                               | Spike sign-in first in #2; fall back to a minimal session library if blocked                                                                                                                             |
| Race conditions in join / call next / transitions                         | Counter row, compare-and-set, `SKIP LOCKED`, unique indexes (§2.3); integration race tests                                                                                                               |
| Service-day boundary and leftover entries                                 | Service day computed once from the configured time zone and passed in; leftover entries are unit-tested in the domain (#3); midnight, UTC-vs-local, and DST tests for `serviceDayFor` are criteria of #9 |
| Serverless driver without transactions                                    | Require a pooled driver with interactive transactions (§2.3)                                                                                                                                             |
| IDOR on guest actions                                                     | Ownership from the session only (§2.3); tests for another guest's entry                                                                                                                                  |
| Merge conflicts between parallel branches                                 | Shared config settled in #1; one threshold line per module; lockfile conflicts resolved from `main`                                                                                                      |

## 5. Change log

- **v3 (#3):** §2.2 updated to the interface settled test-first: snake_case error codes matching
  the PRD, `callNext` instead of `selectNextToCall`, `not_found` / `forbidden` instead of
  `NOT_OWNER` / `FORBIDDEN_ROLE`, check order for `transition`, `serviceDayFor` moved to
  queue-service.
- **v2:** addressed the independent review — first-join race (counter row), compare-and-set for
  all transitions and `SKIP LOCKED` for call-next, service day in the domain interface, leftover
  entries, typed `Result`/`QueueError`, ordering by number, shared conventions between #2 and #3,
  test environments and integration setup, platform and security risks.
- **v1:** initial draft.
