# HW4 team reflection: Claude Code workflow and TDD

Written by the team.

Project: TableQueue (P3), Sprint 1 · Evidence index: [README.md](README.md) · Session log:
[session-log.md](session-log.md)

## 1. How does Explore → Plan → Implement → Commit compare to our previous approach?

Our previous habit with an AI assistant was a single step: describe the feature, accept the
code it produces, then test and patch. That is fast for small, familiar changes, but it trusts
the model's memory of the libraries and leaves design decisions implicit. In this sprint the four
phases replaced that single step, and each phase caught something the old approach would have
missed.

**Explore found the problems before they became code.** Before writing any auth code, Claude read
the Next.js documentation that ships with the installed version and checked Auth.js's peer
dependencies ([`4194a84`](https://github.com/Jasmine-G-uo/tablequeue/commit/4194a8447a48aae016c9427a90404ba757ec4cbd)).
Two findings would have broken a from-memory implementation: Next 16 renamed `middleware` to
`proxy`, and with Cache Components any session read outside `<Suspense>` is a build error. A
one-step prompt would most likely have produced a `middleware.ts` and a page that fails the build.

**Plan made the design reviewable before it was expensive to change.** In Plan mode the agent
could only write a plan, so the decisions (Credentials with JWT sessions, `pg` with
parameterized SQL, bcrypt with a byte-length limit, a database-backed throttle) were approved
first and committed next to the findings
([`bc081aa`](https://github.com/Jasmine-G-uo/tablequeue/commit/bc081aa0d2f975cccb63015560ab1858e32b2323)).
The implementation then followed the plan's order, and the plan file is the record of why.

**Implement was test-first, and the tests came from the issue.** For the queue module (#3) we
wrote criteria 1–8. Criteria 9–12 were drafted by Claude Code during a gap check against the PRD,
and we reviewed and approved them before any test was written. All twelve were committed as
`it.todo` before any code existed, with one term aligned to the PRD (_business day_ → _service
day_). Every criterion then got a red commit with the failing output and a green commit with the
minimum code: 12 criteria, 100% coverage, and a 90% gate in CI (PR #7). Because the criteria are the
test names, "is this issue done?" has a mechanical answer.

**Commit kept the history honest.** Small commits with `[red]` / `[green]` tags, merge-commit-only
PRs, and full-SHA links mean a reviewer can check the process without trusting our word. The same
discipline made our mistakes visible. Two green commits passed the tests but failed typecheck,
because Vitest strips types and those commits had been checked with `npm test` only. We fixed
this in a separate commit with the cause in its message
([`ea15225`](https://github.com/Jasmine-G-uo/tablequeue/commit/ea152255953617f7e4f87f1b37f5e1a615c2eec6))
instead of rewriting history. After that, every commit ran the full self-check from `CLAUDE.md`.

**Independent review was the strongest addition.** Subagent reviews of the PRD and plan found
12 and 10 issues before any code was written: entries left over from yesterday blocking a guest
forever, two definitions of "arrival order", and a race on the first join of the day. A later
review of the auth branch found two real security bugs. The lockout ended about 15 minutes after
the first failure instead of 15 minutes after the fifth, and ten parallel wrong passwords were
all checked. Both were proved with failing tests before they were fixed
([`4b20f79`](https://github.com/Jasmine-G-uo/tablequeue/commit/4b20f7944e470af9162cbcf531f111e0b67410c6) →
[`b25863f`](https://github.com/Jasmine-G-uo/tablequeue/commit/b25863fba5a6ffdd7b603d3fea4604c989eb4fef)).

**The cost** is more ceremony per change. For a one-line fix (a stale CI comment, a README
correction) the full cycle is overhead, and we used a plain commit. For anything with a design
decision or a security property, the extra steps paid for themselves.

## 2. Which context-management strategies worked best?

**Durable files over chat memory.** Decisions went into `docs/PRD.md`, `docs/plan.md`,
`docs/plans/<issue>.md`, and `docs/claude/*.md` as soon as they were made, and `CLAUDE.md` stays
short and `@import`s them. This mattered most: after `/clear` or `/compact` nothing important was
lost, because the conversation was never the only copy.

**Subagents for wide reads and for independent judgment.** Reviews ran in subagents with a
self-contained brief and no conversation history. That kept their file reads out of the main
context and, more importantly, made them independent. A reviewer that hasn't seen our reasoning
judges what is written, not what we meant.

**`/compact` with the work already committed.** The main working session got long. Because every
finished TDD cycle was already committed, `/compact` could keep only the thread (stack, domain
rules, remaining criteria) and the work resumed at the exact next step (session log, entry 13).

**`/clear` between phases and `--continue` to resume.** We cleared when moving from spec work to
setup, since the spec was already in files. `claude --continue -p "Where did we leave off?"`
restored the previous conversation and also checked the real repository state, so its answer
could be trusted (session log, entry 7).

**Giving the agent a way to check itself.** Strictly a workflow rule rather than context
management, but it worked with it: `CLAUDE.md` names one self-check command (lint, format,
typecheck, tests, plus integration tests for database changes). With it, the agent's "done"
means something, and it caught a type error before a commit later in the sprint.

**What we would do differently:** run the full self-check from the first commit, not after the
first slip; pin the toolchain (npm version) on day one, since a lockfile mismatch failed every CI
job; and re-read the diff after automated edits, because two edits silently missed lines that
Prettier had reformatted.
