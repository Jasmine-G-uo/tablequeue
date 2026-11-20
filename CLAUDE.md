# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TableQueue is a digital waitlist for one restaurant: guests register, join the queue, see how many
parties are ahead, and cancel; staff call the next party and mark it seated or skipped. Stack:
Next.js 16 (App Router, `src/` dir) · TypeScript (strict) · Tailwind 4 · PostgreSQL · Auth.js ·
Vercel. Node 24 (`.nvmrc`).

The spec is `docs/PRD.md` (user stories US-01..US-06, queue state machine, non-functional
requirements) and the architecture is `docs/plan.md`. Read both before changing behavior. Sprint
records live in `docs/process/`, independent reviews in `docs/reviews/`.

## Commands

```bash
npm run dev                # dev server (Next 16 regenerates AGENTS.md on start)
npm run build
npm run lint               # ESLint (next core-web-vitals + typescript + prettier)
npm run format:check       # Prettier (printWidth 100, double quotes, trailing commas)
npm run typecheck          # next typegen && tsc --noEmit (typegen must run first)
npm test                   # Vitest "unit" project
npm run test:integration   # Vitest "integration" project (real PostgreSQL)
npm run test:coverage      # unit tests + v8 coverage over src/lib/**
```

Single test file / single test:

```bash
npx vitest run --project unit src/lib/queue/queue.test.ts
npx vitest run --project unit -t "name of the test"
```

## Test layout

`vitest.config.mts` defines two projects:

- **unit**: `src/**/*.test.{ts,tsx}` (excluding integration), `node` environment. Component tests
  opt in to the DOM with a `// @vitest-environment jsdom` comment at the top of the file.
  `vitest.setup.ts` loads jest-dom matchers.
- **integration**: `src/**/*.integration.test.{ts,tsx}`, `node` environment, runs against
  PostgreSQL.

Coverage only counts `src/lib/**`. Per-module thresholds go in `coverage.thresholds` as one line
per module glob (e.g. `"src/lib/queue/**"`) so parallel branches don't conflict.

## Architecture (from docs/plan.md)

Business rules live in a **pure TypeScript domain module** with no I/O; everything touching the
database, session, or network is a thin layer around it.

| Module        | Location                           | Notes                                                            |
| ------------- | ---------------------------------- | ---------------------------------------------------------------- |
| db            | `src/lib/db/`, `db/migrations/`    | Pool, migrations via `npm run db:migrate`, staff seed            |
| auth          | `src/lib/auth/`, `src/app/(auth)/` | Auth.js Credentials, hashing, `requireGuest` / `requireStaff`    |
| queue-domain  | `src/lib/queue/`                   | Pure rules; imports nothing from other modules; built test-first |
| queue-service | `src/lib/queue-service/`           | Transactions, compare-and-set, maps session → domain `Actor`     |
| guest-ui      | `src/app/(guest)/`                 | Join, status (10 s refresh), cancel                              |
| staff-ui      | `src/app/staff/`                   | Queue list, call next, seat, skip                                |

Key invariants:

- Queue states: `waiting → called → seated | skipped`; guest may cancel from `waiting` or
  `called`. Ordering is always by queue `number`, never `joinedAt`.
- An entry is **active** only if `waiting`/`called` **and** on today's service day; leftover
  entries from earlier days are expired and cannot transition.
- Domain functions return a typed `Result<T>` / `QueueError` instead of throwing.
- User ids are string UUIDs; roles are exactly `"guest" | "staff"`.
- Every transition is a compare-and-set `UPDATE … WHERE status = $from`; call-next uses
  `FOR UPDATE SKIP LOCKED`; numbering uses a per-day counter row. The DB driver must support
  interactive transactions.
- Ownership always comes from the session (`guest_id = session.userId`), never from a
  client-supplied id.

## Next.js 16 notes

APIs differ from older Next.js versions (e.g. `middleware` → `proxy`, `cacheComponents` is on in
`next.config.ts`). Check `node_modules/next/dist/docs/` and installed types before relying on
remembered APIs. Enforce roles in every server action / route handler, not only in `proxy`.
