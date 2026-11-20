# Plan review — 2026-11-20

Reviewer: independent Claude Code subagent (no shared context with the author session)

## Summary

The plan's main choice is sound: a pure domain core with a thin transactional service, and #2 and #3 really can run in parallel. The locking design in §2.2 does not hold for the first join of a service day or for the seat/skip/cancel transitions. The draft domain interface has no notion of a service day and no error model, so some PRD criteria cannot be tested as written. Fix the must-fix items in the plan before #3 starts writing tests, because they change function signatures.

## Findings

1. **must-fix — §2.2 Consistency rules: `SELECT … FOR UPDATE` cannot lock rows that do not exist.**
   When no entries exist yet today (the first join of the day), two concurrent joins both lock nothing, both compute number 1, and one fails on the unique index with a raw error. Postgres also rejects `FOR UPDATE` together with an aggregate such as `MAX(number)`.
   Fix: serialize on a row that always exists. One option is a per-day counter `queue_counters(restaurant_id, service_day, last_number)` updated with `INSERT … ON CONFLICT DO UPDATE SET last_number = last_number + 1 RETURNING last_number`. Another is `pg_advisory_xact_lock(hash(restaurant_id, service_day))`. Keep the unique index as a backstop, and map error `23505` to a domain error instead of a 500.

2. **must-fix — §2.2: seat, skip, and cancel are not covered, and the call-next query shape is unspecified.**
   Seat, skip, and cancel do read → `transition()` → write with no lock. A guest cancel racing a staff seat can produce `cancelled → seated`, which §4.2 forbids. Separately, `… WHERE status='waiting' ORDER BY number LIMIT 1 FOR UPDATE` can return zero rows to the second caller after it re-checks the row, so the second staff member sees "queue empty" while parties are still waiting.
   Fix: make every transition a compare-and-set (`UPDATE … SET status=$to WHERE id=$id AND status=$from RETURNING *`), and treat zero rows as `INVALID_TRANSITION`. For call-next, either lock under the same per-day lock as joins, or use `FOR UPDATE SKIP LOCKED LIMIT 1`. Add an integration test for each race.

3. **must-fix — §2.1 Interface: the service day is missing from the domain.**
   The text says the service day is "passed in", but no signature takes one. `QueueEntry` has no `serviceDay` or `restaurantId`, and there is no pure `serviceDayFor(now, timeZone)`. Callers also cannot tell which entries to pass in. `nextQueueNumber(todaysEntries)` needs today's entries in every status. `canJoin` needs the guest's active entries from any day. `partiesAhead` needs today's waiting entries.
   Fix: add `serviceDay: string` (an ISO date) to `QueueEntry` and export `serviceDayFor(now: Date, tz: string)`. Have the list-based functions take `(entries, serviceDay)` and filter inside the domain, so tests cover the midnight boundary.

4. **should-fix — §4 Risks: stale active entries across midnight.**
   The one-active-entry index has no day column. An entry still `waiting` or `called` from yesterday will block that guest from joining forever, and the staff page ("today's entries") will never show it.
   Fix: decide a policy and add it to the PRD's open items. One option is that active entries from earlier days count as expired, either through a domain rule or a nightly or lazy close to `skipped`. Test it in the domain.

5. **should-fix — §2.1: `Result<T>` and its error cases are undefined.**
   The PRD needs distinct outcomes. US-02 must show the existing entry, and US-04 separates "already final" from "someone else's". `canJoin(): Result<void>` cannot carry the existing entry.
   Fix: define `Result<T, QueueError>` with a discriminated `code`: `INVALID_PARTY_SIZE`, `ALREADY_ACTIVE { entry }`, `INVALID_TRANSITION { from, to }`, `NOT_OWNER`, `FORBIDDEN_ROLE`, `QUEUE_EMPTY`. Have `selectNextToCall` return `QUEUE_EMPTY`, or keep `null` but document how the UI message is chosen.

6. **should-fix — §2.1: ordering and numbering rules are ambiguous.**
   `partiesAhead` counts entries that "joined earlier", but `joinedAt` can tie, and clocks drift across Vercel instances. Also, `partiesAhead` returns `number` for a non-waiting entry. `nextQueueNumber` breaks if it is implemented as a count, or fed only active rows (US-06: numbers are never reused). Nothing builds the staff list, so guest and staff views can diverge (the PRD anti-goal in §3).
   Fix: order by `number`, which is unique and monotonic within a day. Return `number | null` from `partiesAhead`. Specify `nextQueueNumber` as max(number of today's entries in any status) + 1. Add `activeQueue(entries, serviceDay)` for both views and derive `partiesAhead` from it.

7. **should-fix — §2 Modules / §3.1: hidden coupling between auth (#2) and queue-domain (#3).**
   `Actor.role` and `userId: string` duplicate types that #2 will define for the session and the users table. The id format (uuid or serial) and the role names have to match. #2 also owns `db`, the migration tool, and the schema conventions that the later queue tables depend on. Both branches are likely to edit `vitest.config.mts` (coverage thresholds) and `package.json`.
   Fix: say in the plan that the domain owns its own structural `Actor` type and queue-service maps the session onto it, so the domain never imports auth. Agree in #1 on ids as string UUIDs and the role literals `"guest" | "staff"`. Put per-module coverage thresholds on separate lines so they merge cleanly.

8. **should-fix — §3 / test setup: the test infrastructure does not match the testing claims.**
   The `unit` project runs every `src/**/*.test.ts` under jsdom, including pure domain and auth code. Auth.js/jose has known `Uint8Array` realm problems under jsdom. The `integration` project has no database setup. There is no `.github/` CI yet, and no plan for a Postgres service in CI. The race tests in §4 need real Postgres with two concurrent connections, which mocks cannot replace.
   Fix: add a `node`-environment unit project for `src/lib/**`, or use per-file `// @vitest-environment node`. Add a `globalSetup` that migrates a throwaway database, a Postgres service container in CI, and a concurrency test pattern (`Promise.all` over two pooled clients).

9. **should-fix — §4 Risks: platform and security risks not listed.**
   (a) Serverless HTTP Postgres drivers on Vercel, such as Neon's `neon()` HTTP mode, do not support interactive multi-statement transactions, so §2.2 would silently stop applying. Require a driver or pool that supports `BEGIN … FOR UPDATE … COMMIT`.
   (b) Auth.js is not installed yet, and its compatibility with Next 16 (`middleware` renamed to `proxy`) is unproven. Enforce roles in every server action or route handler with `requireStaff`/`requireGuest`, not only in `proxy`.
   (c) Guest cancel and status should resolve the entry from the session, not from a client-supplied id, to avoid IDOR (PRD anti-goal: guests changing other guests' entries).

10. **nit — §2 / §2.1: small items.**
    Coverage of ≥70% is low for a pure module built test-first; aim for ~90% branches, plus an exhaustive table test over status × target × role. Say whether `validatePartySize` accepts the form strings `"4"`, `" 4"`, `"4.0"`, and `"1e1"`. Scope the partial unique index as `(restaurant_id, guest_id)` to match the multi-restaurant intent.

## What is solid

- Splitting into a pure domain plus a thin service makes TDD of the state machine and numbering fast and deterministic. Injecting `now` is the right call.
- Database constraints (unique number per day, partial unique index for active entries) are a correct backstop to application logic, not a replacement for it.
- #2 and #3 really are independent at the code level: the domain needs no database, session, or Next.js imports.
- The risks table already names the right hot spots (races, the service-day boundary, Next 16 API drift). Findings 1–4 make those mitigations concrete.
