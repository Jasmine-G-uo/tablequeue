# #3 Queue domain logic (TDD)

- Issue: #3 · Branch: `feature/3-queue-domain` · Module: queue-domain (`src/lib/queue/`)
- Spec: PRD §4 (queue model), US-02..US-06 · Interface: [plan.md §2.2](../plan.md)

## Explore and plan

queue-domain is pure (no database, auth, or Next.js), so there was no existing code to explore
beyond the scaffold. The plan for this issue is plan.md §2.2, the interface draft written and
independently reviewed in #1 ([plan review](../reviews/plan-review.md)); it said exact
signatures would be settled test-first here. This file records how they were settled.

## How the work was done

1. The 12 acceptance criteria from #3 were committed unchanged as `it.todo` descriptions
   (`6bd1efa`), and each is now the title of a `describe` block in `queue.test.ts`.
2. Each criterion went through red → green (→ refactor). Red commits change only the test file and
   quote the failing output; green commits change only `queue.ts`.
3. Self-check before each commit: `npm run lint && npm run format:check && npm run typecheck &&
npm test`.

| Criterion             | Red       | Green     | Refactor  |
| --------------------- | --------- | --------- | --------- |
| Party size            | `fb6ab5d` | `f09e138` |           |
| Queue number          | `01cadf0` | `2f16b91` |           |
| One active entry      | `c24bb11` | `7c71154` |           |
| Staff list order      | `02b6db7` | `c30e388` | `f1dadff` |
| Parties ahead         | `7fb659d` | `c907663` |           |
| Call next             | `921d78f` | `3cb57c6` |           |
| Seat / skip           | `5f39858` | `1cb49ab` |           |
| (type fix, see below) |           | `ea15225` |           |
| Cancel                | `078bef6` | `bca8316` |           |
| Invalid status change | `3998266` | `9bf0eaa` |           |
| Someone else's entry  | `b9f6448` | `325a290` |           |
| Entry from yesterday  | `2775a25` | `4e1b91b` | `5d4313c` |
| Wrong role            | `c1fecb6` | `a3fdd8f` |           |
| Coverage gate         | `4df34f5` |           |           |

## Decisions made while testing

- **Error codes are snake_case** and match the PRD (`invalid_party_size`, `already_in_queue`,
  `invalid_transition`, `not_found`, `forbidden`, `queue_empty`), so the API layer can pass them
  through instead of renaming them. The draft used SCREAMING_SNAKE names.
- **`callNext(entries, actor, now, serviceDay)`** replaces the draft's `selectNextToCall`: it
  checks the role and returns the called entry, so staff "Call next" is one domain call.
- **Check order in `transition`:** role (`forbidden`) → ownership for guests (`not_found`) →
  expiry and status table (`invalid_transition`). Another guest always gets `not_found`, even for
  an entry that is already final, so a refusal never reveals the entry's state.
- **Status table and roles are data** (`NEXT_STATUSES`, `ROLE_FOR`), copied from PRD §4.2, and the
  test walks every one of the 25 status pairs.
- **`isActive` stays internal**; it is tested through `activeQueue`, `partiesAhead`, `canJoin`, and
  `transition`, which are what callers use.
- **`serviceDayFor(now, timeZone)` moves to queue-service.** No #3 criterion needs it, and it is
  the only function that reads a time zone.
- **`nextQueueNumber` keeps an optional `restaurantId`**, because the criterion says numbers are
  unique per restaurant and service day.
- **Coverage gate:** `src/lib/queue/**` must stay at 90% lines, functions, branches, and
  statements (course minimum 70%). It is currently 100%.

## Incident: typecheck broken for two commits

`3cb57c6` and `1cb49ab` returned `queue_empty` and `invalid_transition`, but the edit that added
those codes to the `QueueError` type did not apply. Prettier had joined the union onto one line, so
the text being replaced no longer matched. Vitest strips types, so the tests passed, but
`npm run typecheck` failed (TS2322). Those two commits had been checked with `npm test` only.
`ea15225` adds the missing codes, and every later commit ran the full self-check. The lesson is now
in the self-check rule: run typecheck too, not just the tests, before every commit, including green
ones.
