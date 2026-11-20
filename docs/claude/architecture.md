# Architecture decisions

Short decision records. Each one says what we chose and why, so future changes can tell whether
the reason still holds. The full design is in `docs/plan.md`.

## AD-1 Pure domain module

Queue rules (numbering, ordering, parties ahead, state machine, validation) live in
`src/lib/queue/` as pure functions with no imports from the database, auth, or Next.js.
**Why:** the rules are the riskiest part of the app and must be built test-first; pure functions
make those tests fast and deterministic, and let the guest and staff sides share one source of
truth.

## AD-2 One restaurant per deployment

Every table has a `restaurant_id`, but it is a single seeded constant.
**Why:** the proposal targets one small restaurant; keeping the column makes multi-restaurant
support possible later without a schema rewrite.

## AD-3 Queue number is the only ordering key

"Ahead", "behind", and "next" always compare queue numbers within one service day, never
`joinedAt`.
**Why:** timestamps tie and drift across serverless instances; numbers are unique and monotonic.

## AD-4 Database enforces concurrency

A per-day counter row (`INSERT … ON CONFLICT DO UPDATE … RETURNING`) assigns numbers, a partial
unique index allows one active entry per guest, every transition is a compare-and-set
(`UPDATE … WHERE status = $from`), and call-next uses `FOR UPDATE SKIP LOCKED`.
**Why:** UI checks cannot prevent races between two staff tablets or a guest double-submitting.
The driver must support interactive transactions (a `pg` pool, not an HTTP-only driver).

## AD-5 Typed results instead of exceptions in the domain

Domain functions return `Result<T>` with a discriminated `QueueError` code.
**Why:** each PRD error case maps to a code that tests can assert and the API can translate to an
HTTP status (PRD §6.2).

## AD-6 Service day passed in, never read inside the domain

Callers compute `serviceDayFor(now, timeZone)` once and pass `now` and the service day into every
domain function.
**Why:** midnight and leftover-entry behavior must be testable with a fixed clock.

## AD-7 Auth.js Credentials with server-side role checks

Guests self-register with email and password; staff come from a seed script. Every server action
and route handler calls `requireGuest` / `requireStaff`.
**Why:** route-level protection (`proxy`) alone is easy to bypass by calling an action directly.

## AD-8 Next.js 16 conventions and AGENTS.md

Next 16 renamed `middleware` to `proxy` and enables `cacheComponents` in `next.config.ts`. Its
`next dev` writes and maintains `AGENTS.md`, which tells agents to read the version-matched docs
in `node_modules/next/dist/docs/` before writing Next.js code. We commit `AGENTS.md` and import it
from `CLAUDE.md` instead of fighting the regeneration.
**Why:** APIs differ from what models remember; the bundled docs match the installed version.
