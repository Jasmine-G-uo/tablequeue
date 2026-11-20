# CLAUDE.md

Guidance for Claude Code in this repository. This file stays short; detailed rules live in the
imported files below and load with it.

## Project

TableQueue is a digital waitlist for one restaurant: guests register, join the queue, see how many
parties are ahead, and cancel; staff call the next party and mark it seated or skipped.

**Stack:** Next.js 16 (App Router, `src/`) · TypeScript (strict) · Tailwind 4 · PostgreSQL ·
Auth.js · Vitest · Vercel. Node 24 (`.nvmrc`).

## Context (imported)

- Product spec — user stories, state machine, non-functional requirements: @docs/PRD.md
- Architecture and delivery plan: @docs/plan.md
- Architecture decisions and their reasons: @docs/claude/architecture.md
- Coding and git conventions: @docs/claude/conventions.md
- Testing strategy (TDD is mandatory): @docs/claude/testing.md
- Team workflow (sprints, issues, branches, PRs, review): @docs/claude/workflow.md
- Security rules, OWASP Top 10, Definition of Done: @docs/claude/security.md
- Context management (`/clear`, `/compact`, `--continue`, subagents): @docs/claude/context-management.md
- Next.js 16 agent rules (maintained by `next dev`): @AGENTS.md

## Commands

```bash
npm run dev                # dev server (also regenerates AGENTS.md)
npm run build
npm run lint               # ESLint (next core-web-vitals + typescript + prettier)
npm run format             # Prettier write; format:check to verify
npm run typecheck          # next typegen && tsc --noEmit (typegen must run first)
npm test                   # Vitest "unit" project
npm run test:integration   # Vitest "integration" project (real PostgreSQL)
npm run test:coverage      # unit tests + v8 coverage over src/lib/**
npx vitest run --project unit src/lib/queue/queue.test.ts   # one file
npx vitest run --project unit -t "name of the test"         # one test
```

## Validate your own work

Before every commit, run and read the output of:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
```

Add `npm run test:integration` for database or auth changes. Never report something as done
without this passing.

## How we work

Every change starts from a GitHub issue whose acceptance criteria are the failing tests. One
branch per issue → Explore → Plan (committed to `docs/plans/`) → test-first implementation →
PR with AI disclosure → green CI → partner review → merge commit. Details in `workflow.md` and
`testing.md`.

## Do

- Read the issue's acceptance criteria and the matching PRD section before touching code.
- Write the failing test first; keep the red commit with its failing output.
- Keep domain code pure; pass `now` and the service day in.
- Check `node_modules/next/dist/docs/` before using a Next.js API from memory.
- Write decisions into the plan or docs as you make them.
- Stage files by name and keep each commit to one logical step.
- Ask before anything irreversible or outward-facing (merging, deleting branches, publishing).

## Don't

- Don't `git add -A`, `git add .`, `git commit -a`, force-push, or push to `main`.
- Don't read or print real `.env` files or secrets; add new variables to `.env.example` instead.
- Don't skip, weaken, or delete a test or CI check to get green.
- Don't trust a client-supplied user or entry id; take ownership from the session.
- Don't build SQL by string concatenation.
- Don't add features beyond the issue (multi-restaurant, notifications, ETAs are non-goals).
- Don't self-approve or merge without the partner's review.

## Key invariants

- Queue states: `waiting → called → seated | skipped`; the owning guest may cancel from `waiting`
  or `called`. Ordering is always by queue `number`, never `joinedAt`.
- An entry is **active** only if `waiting`/`called` **and** on today's service day; leftover
  entries from earlier days are expired and cannot transition.
- Domain functions in `src/lib/queue/` are pure and return `Result<T>` / `QueueError`.
- User ids are string UUIDs; roles are exactly `"guest" | "staff"`.
- Ownership always comes from the session, never from a client-supplied id.
