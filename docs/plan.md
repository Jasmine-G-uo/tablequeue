# TableQueue — Architecture and Delivery Plan

- Status: Draft v1 (Sprint 1)
- Spec: [PRD.md](PRD.md)
- Last updated: 2026-11-20

## 1. Approach

A single Next.js (App Router) application deployed on Vercel, backed by PostgreSQL. Business rules
live in a **pure TypeScript domain module** with no I/O, so they can be built test-first and reused
by both the guest and staff sides. Everything that touches the database, the session, or the
network is a thin layer around that core.

Alternatives considered:

| Option                                        | Trade-off                                                        | Decision                                     |
| --------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Rules inside route handlers / server actions  | Fastest to start; rules get duplicated and are hard to unit-test | Rejected                                     |
| Rules in SQL (constraints + stored functions) | Strong consistency; hard to TDD and to review                    | Partly used: only for uniqueness and locking |
| Pure domain module + thin persistence layer   | Fast unit tests, one source of truth, DB used for atomicity      | **Chosen**                                   |

## 2. Modules

Each module can be developed and tested on its own branch. Arrows show "depends on".

```
guest-ui ─┐                ┌─▶ queue-domain (pure)
          ├─▶ queue-service┤
staff-ui ─┘        │       └─▶ db
                   └──────────▶ auth ──▶ db
```

| Module            | Location                           | Responsibility                                                                                                     | Tests                     |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| **db**            | `src/lib/db/`, `db/migrations/`    | Connection, migrations (`npm run db:migrate`), seed script for staff accounts                                      | integration               |
| **auth**          | `src/lib/auth/`, `src/app/(auth)/` | Registration, sign-in/out with Auth.js Credentials, password hashing, role checks (`requireGuest`, `requireStaff`) | unit + integration        |
| **queue-domain**  | `src/lib/queue/`                   | Pure rules: state machine, queue numbering, parties ahead, call-next selection, validation                         | unit (TDD, ≥70% coverage) |
| **queue-service** | `src/lib/queue-service/`           | Loads/saves entries in transactions, applies domain rules, enforces ownership and atomicity                        | integration               |
| **guest-ui**      | `src/app/(guest)/`                 | Join form, status page with 10 s refresh, cancel button                                                            | component + E2E           |
| **staff-ui**      | `src/app/staff/`                   | Queue list, call next, seat, skip                                                                                  | component + E2E           |

### 2.1 queue-domain interface (draft)

The exact signatures are settled test-first in #3; this is the intended shape.

```ts
type QueueStatus = "waiting" | "called" | "seated" | "skipped" | "cancelled";
type Actor = { role: "guest" | "staff"; userId: string };

interface QueueEntry {
  id: string;
  guestId: string;
  partySize: number;
  number: number; // per service day, starts at 1
  status: QueueStatus;
  joinedAt: Date;
  statusChangedAt: Date;
}

validatePartySize(size: unknown): Result<number>;
nextQueueNumber(todaysEntries: QueueEntry[]): number;
canJoin(entries: QueueEntry[], guestId: string): Result<void>;
partiesAhead(entries: QueueEntry[], entryId: string): number;
selectNextToCall(entries: QueueEntry[]): QueueEntry | null;
transition(entry: QueueEntry, to: QueueStatus, actor: Actor, now: Date): Result<QueueEntry>;
```

Time is always passed in (`now`, service day), never read inside the module, so tests are
deterministic.

### 2.2 Consistency rules (queue-service)

- Joining and "call next" run in a transaction that locks today's queue rows
  (`SELECT … FOR UPDATE`), so two requests cannot receive the same number or call the same party.
- A unique index on `(restaurant_id, service_day, number)` backs the numbering rule.
- A partial unique index on `guest_id WHERE status IN ('waiting','called')` backs the
  one-active-entry rule.

## 3. Delivery

### 3.1 Sprint 1 (HW4 scope)

| Issue | Title                                            | Module(s)    | Branch                   | Depends on |
| ----- | ------------------------------------------------ | ------------ | ------------------------ | ---------- |
| #1    | Project spec, Claude Code rules, permissions, CI | —            | `chore/1-project-setup`  | —          |
| #2    | Guest registration and sign-in                   | db, auth     | `feature/2-auth`         | #1         |
| #3    | Queue domain logic (TDD)                         | queue-domain | `feature/3-queue-domain` | #1         |
| #4    | HW4 session log and reflection                   | docs         | `docs/4-hw4-reflection`  | #1         |

#2 and #3 are independent of each other and can be developed in parallel.

### 3.2 Backlog (later P3 sprints)

- Queue persistence and API (queue-service) — US-02..US-06 server side.
- Guest join/status/cancel pages — US-02..US-04.
- Staff queue page — US-05, US-06.
- Staff seed script and role-based route protection end-to-end.
- Playwright E2E for the guest and staff happy paths.
- Vercel preview and production deploys, AI PR review, security scanning gates.

## 4. Risks

| Risk                                             | Mitigation                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Next.js 16 / Auth.js APIs differ from older docs | Read `node_modules/next/dist/docs/` and the installed Auth.js types before coding |
| Race conditions in join / call next              | Transactions with row locks + unique indexes (§2.2), integration tests for both   |
| Service-day boundary bugs (midnight, time zone)  | Service day computed once from a configured time zone and passed into the domain  |
| Merge conflicts between parallel branches        | Shared config (vitest, CI) settled in #1; lockfile conflicts resolved from `main` |
