# Annotated Claude Code session log (Sprint 1)

These excerpts come from the Claude Code sessions used to build TableQueue in Sprint 1. They are
trimmed for length: `…` marks a cut, and `<repo>` replaces the local project path. Quoted text is
copied from the transcripts and not reworded. Each entry ends with an annotation saying what was
done, why, and what came of it, and links the commit that resulted.

The entries follow the HW4 workflow: spec → project setup (Part 1) → Explore → Plan → Implement →
Commit (Part 2) → TDD (Part 3).

---

## 1. Spec brainstorming

_Summary of the assistant's message (not a verbatim quote)._ Following the brainstorming skill,
Claude first restated its understanding of the product: guests register, join with a party size,
see how many parties are ahead, and can cancel; staff see the queue in order, call the next party,
and mark it seated or skipped. It then asked the question with the biggest effect on the design:
**one restaurant per deployment, or many?** It recommended a single restaurant, keeping a
`restaurant_id` column so multi-restaurant support would not need a schema rewrite later. Claude
re-read the approved proposal, which only ever says "the restaurant's waitlist", and settled on
a single restaurant.

**Annotation.** The brainstorming step turned an ambiguity into an explicit decision before any
spec was written. The answer was checked against the proposal instead of assumed, and it became
PRD §2 and architecture decision AD-2. → [`7941cba`](https://github.com/Jasmine-G-uo/tablequeue/commit/7941cba0f3c18c50dbd2e6d67c5266fdbe350fc1)

---

## 2. Independent subagent reviews of the PRD and the plan

```text
[Agent] description: "Independent PRD review"
  You are an independent reviewer of a product requirements document. You have no prior
  context; judge only what is written.
  Read <repo>/docs/PRD.md. … Review it for:
  1. Acceptance criteria that are ambiguous, untestable, or contradict each other or the state
     machine in section 4.
  2. Missing behaviors or edge cases … 3. Security gaps relevant to OWASP Top 10 … 4. Scope creep …
  Do NOT edit PRD.md. Write your review to <repo>/docs/reviews/prd-review.md …

[hand-back] It has 12 findings: 5 must-fix, 5 should-fix and 2 nits.
  1. Entries left over from a previous service day … blocks the guest from ever joining again.
  2. "Arrival order" is defined two ways (joined-at time vs. queue number) …
  4. Race outcomes are not specified … 5. No protection against brute-force … no limit on
     session lifetime.

[Agent] description: "Independent plan review"
  … Does the module split let #2 (auth) and #3 (queue domain) really be built independently? …
  Are the consistency rules (locking, unique indexes) correct and sufficient for concurrent
  joins and call-next?
[hand-back] 10 findings … Must-fix:
  1. §2.2: `SELECT … FOR UPDATE` cannot lock rows that do not exist, so the first join of a
     service day can race.
  2. §2.2: seat, skip and cancel are not covered by the locking rules …
  3. §2.1: the service day is missing from the domain interface.
```

**Annotation.** The reviewer got no conversation context, only the file and a checklist, so it
judged the documents rather than our intentions. It was also not allowed to edit the spec. Its
findings shaped the rest of the sprint: leftover entries became the "Entry from yesterday"
criterion, the queue number became the only ordering key, and the plan gained a per-day counter
row and compare-and-set transitions. Reviews and revisions were committed separately, so the
change is visible: PRD review [`485b3d5`](https://github.com/Jasmine-G-uo/tablequeue/commit/485b3d5aabd6d3a1e011688be5f2325a5f00f301) → PRD v2 [`7d5fe40`](https://github.com/Jasmine-G-uo/tablequeue/commit/7d5fe4011cf44005634657afb6d2cc4d8f46e553); plan review [`2f4dc51`](https://github.com/Jasmine-G-uo/tablequeue/commit/2f4dc514882398d565d7a2194fd1f6b87894c4e5) → plan v2
[`0a2646b`](https://github.com/Jasmine-G-uo/tablequeue/commit/0a2646bc01acf430bdd3aec3caceda3c745b32eb).

---

## 3. `/clear` before switching from planning to building

```text
<command-name>/clear</command-name>
<command-message>clear</command-message>
<command-args>…</command-args>
<local-command-stdout></local-command-stdout>
```

**Annotation.** Spec work was done and every decision was already in `docs/PRD.md` and
`docs/plan.md`, so the old conversation would only have distracted the next task. Clearing
started the setup work with a clean context; the next commit in that session was the `/init`
output. → [`adfa0bf`](https://github.com/Jasmine-G-uo/tablequeue/commit/adfa0bfc0dca7d11586488d1445f2750f1630490)

---

## 4. `/init`, then iterating on CLAUDE.md

```text
[assistant] There's no CLAUDE.md yet, so `/init` hasn't run. I'm running it now …
[Skill] {"skill": "init"}
[Write] <repo>/CLAUDE.md
  # CLAUDE.md
  This file provides guidance to Claude Code (claude.ai/code) when working with code in this
  repository.
  ## Project
  TableQueue is a digital waitlist for one restaurant … Stack: Next.js 16 (App Router, `src/`
  dir) · TypeScript (strict) · Tailwind 4 · PostgreSQL · Auth.js · Vercel. Node 24 (`.nvmrc`).
  ## Commands … ## Test layout … ## Architecture (from docs/plan.md) … ## Next.js 16 notes …
[Bash] git add CLAUDE.md && git commit -q -m "chore(claude): add CLAUDE.md generated by /init (#1) …"
  adfa0bf chore(claude): add CLAUDE.md generated by /init (#1)

[assistant] Before I rewrite the main CLAUDE.md, I want to check one thing `/init` claimed
  (`cacheComponents` is enabled), so the docs don't contain anything false:
  … cacheComponents: true, …
  1e26616 docs(claude): split CLAUDE.md into imported rule files (#1)
[assistant] That was the first iteration. The second adds the security rules, the
  context-management strategy, and the Do's / Don'ts:
  a3b258b docs(claude): add security rules, context management, and do's/don'ts (#1)
[assistant] CLAUDE.md now has 3 versions in git history: the raw `/init` output, then two iterations.
```

**Annotation.** The raw `/init` output was committed unchanged so the iterations can be compared
against it. Before rewriting, Claude checked a claim `/init` had made against `next.config.ts`
instead of trusting it. Iteration 1 kept `CLAUDE.md` short and moved detail into `@import`ed
files under `docs/claude/`. Iteration 2 added security rules, context management, and Do/Don't
lists. A later pass aligned the rules with how we actually worked. → [`adfa0bf`](https://github.com/Jasmine-G-uo/tablequeue/commit/adfa0bfc0dca7d11586488d1445f2750f1630490) → [`1e26616`](https://github.com/Jasmine-G-uo/tablequeue/commit/1e26616d303c2d7b212108832261e0cc1ac13d22) →
[`a3b258b`](https://github.com/Jasmine-G-uo/tablequeue/commit/a3b258b6f40cef2c0078dee175d0c9e864f9210f) → [`d0d2df4`](https://github.com/Jasmine-G-uo/tablequeue/commit/d0d2df438f87502e381b3afea251c67941218d22)

---

## 5. Checking that a permission deny rule really works

```text
[assistant] Now I'll check whether the deny rules actually work. `git add -A` should be blocked,
  and `git add .claude/settings.json` should go through:
[Bash] git add -A
  Permission to use Bash with command git add -A has been denied.
[Bash] git status --short && npx prettier --check .claude/settings.json && git add .claude/settings.json && git status --short
  ?? .claude/
  All matched files use Prettier code style!
  A  .claude/settings.json
  5d1d3f0 chore(claude): add shared permission allowlist and deny rules (#1)
```

**Annotation.** Each rule was tested both ways: the risky command is refused and the normal one
still works. Entry 15 tests more rules added later. → [`5d1d3f0`](https://github.com/Jasmine-G-uo/tablequeue/commit/5d1d3f035abb2c35b9c0929aa67e0f6264f60566)

---

## 6. CI fails on every job, then diagnosis and fix

```text
  Build fail 19s … Dependency audit fail 6s … Integration tests (PostgreSQL) fail 24s …
  Lint (ESLint + Prettier) fail 7s … Typecheck fail 7s … Unit tests + coverage fail 7s
[assistant] All 6 CI jobs failed within seconds, so they probably share one cause, likely an
  install-step problem.
  npm error `npm ci` can only install packages when your package.json and package-lock.json …
  are in sync.
  npm error Missing: @emnapi/runtime@1.11.3 from lock file
  npm error Missing: @emnapi/core@1.11.3 from lock file
… node: v24.22.3 … npm: 11.19.1
[assistant] CI uses npm 11.19.1 and your machine has 11.6.1. I'll regenerate the lockfile with
  the same npm version CI uses, then run `npm ci` with that version locally to confirm it passes:
[Bash] rm package-lock.json && npx -y npm@11.19.1 install … && npx -y npm@11.19.1 ci … && npm test … && npm run build …
  Build pass 23s … Dependency audit pass 21s … Integration tests (PostgreSQL) pass 37s …
  Lint (ESLint + Prettier) pass 27s … Typecheck pass 19s … Unit tests + coverage pass 25s
```

**Annotation.** Six fast failures pointed to one shared cause, so Claude read the install log
instead of fixing jobs one at a time. It reproduced CI's npm version locally before pushing.
The lesson ("generate the lockfile with CI's npm") went into `docs/claude/workflow.md` so it
won't recur. → [`cc83081`](https://github.com/Jasmine-G-uo/tablequeue/commit/cc83081a287bb8c1268b57ba309d3894b6e9c2c1)

---

## 7. `--continue`: resuming a session without re-explaining

```text
$ claude -p "Read docs/plan.md and issue #2 (gh issue view 2). In 5 bullets, what must the auth work deliver and in what order?" --allowedTools Read "Bash(gh issue view:*)"
Issue #2 needs these, in this order:
1. **Set up the branch, then Explore and Plan before writing code.** Branch `feature/2-auth` …
   Commit the Explore findings, then the approved plan, to `docs/plans/2-auth.md`. …
2. **Build the database layer and the integration test setup.** …
3. **Build registration test-first (pure validation, then persistence).** …
4. **Build sign-in, throttling and sessions.** …
5. **Add `requireGuest` / `requireStaff`, then finish.** …

$ claude --continue -p "Where did we leave off, and what is the next step?"
We haven't started the auth work yet. So far we've only read `docs/plan.md` and issue #2 and
agreed on the five-step order.
- **Branch:** you're on `chore/1-project-setup`, which is clean and in sync with origin.
- **Not started:** `feature/2-auth` doesn't exist locally or on the remote, and there's no
  `docs/plans/` folder …
**Next step:** create the branch and start Explore.
1. `git switch -c feature/2-auth` from `chore/1-project-setup`.
2. Explore without changing code: … `node_modules/next/dist/docs/` …
3. Write the findings to `docs/plans/2-auth.md` and commit them as `docs(explore): … (#2)`.
```

**Annotation.** The second command carries no context of its own; the answer shows it restored
the first conversation and checked the repository's real state, not just what it remembered. We
asked "where did we leave off?" before acting, as `context-management.md` recommends. The next
step it named is exactly the next commit. → [`4194a84`](https://github.com/Jasmine-G-uo/tablequeue/commit/4194a8447a48aae016c9427a90404ba757ec4cbd)

---

## 8. Explore (issue #2, auth)

```text
[Bash] cd node_modules/next/dist/docs/01-app/02-guides && wc -l authentication.md authentication-with-cache-components.md && grep -n … authentication.md
[assistant] Next, checking whether Auth.js supports this version of Next.js. This is the biggest
  risk in the plan:
[Bash] npm view next-auth dist-tags --json; npm view next-auth@beta version peerDependencies --json …
  "version": "5.0.0-beta.32", "peerDependencies": { "next": "^14.0.0-0 || ^15.0.0 || ^16.0.0", …
  18:With [Cache Components] enabled, a session read happens at request time, so it can't be
  prerendered into the static shell. Authenticated UI streams in behind a `<Suspense>` boundary …
[Write] docs/plans/2-auth.md
  ## Explore findings
  - **`middleware` is now `proxy`** … Route-level checks in `proxy` are an optimization only …
  - **Cache Components:** reading `cookies()` (any session read) outside a `<Suspense>` boundary
    is a **build error** …
  4194a84 docs(explore): findings for guest registration and sign-in (#2)
```

**Annotation.** Explore made no code changes. In this Claude Code setup, search runs through the
Bash tool (`grep -n`, `wc -l`) rather than separate Glob/Grep tools, and nothing was edited until
the findings were written down. It read the Next.js docs that ship with the
installed version (not the model's memory of older versions) and checked the riskiest dependency
first. Two findings would have broken a from-memory implementation: `middleware.ts` is now
`proxy.ts`, and session reads must sit behind `<Suspense>`. → [`4194a84`](https://github.com/Jasmine-G-uo/tablequeue/commit/4194a8447a48aae016c9427a90404ba757ec4cbd)

---

## 9. Plan mode

```text
[EnterPlanMode] {}
  Entered plan mode. You should now focus on exploring the codebase and designing an
  implementation approach. …
[Write] <plans dir>/….md
  # Plan — Issue #2: Guest registration and sign-in
  ## Decisions
  | Auth library | `next-auth@5.0.0-beta.32` (Auth.js), Credentials provider, JWT sessions, `maxAge` 8 h | …
  | DB access | `pg` Pool (`src/lib/db/pool.ts`), parameterized SQL only | Interactive transactions needed later …
  | Hashing | `bcryptjs` cost 12; length checked in UTF-8 **bytes** (8 chars min, 72 bytes max) | …
  | Throttling | `login_attempts(email, attempted_at, succeeded)`; locked if ≥5 failures in the last 15 min … |
[ExitPlanMode] {}
  User has approved your plan. You can now start coding. …
[assistant] Plan approved. Commit 1: write the plan into `docs/plans/2-auth.md`:
  bc081aa docs(plan): implementation plan for auth (#2)
```

**Annotation.** In Plan mode the agent can only write the plan, not project files, so the design was reviewed and approved
before any code existed. The approved plan was committed next to the Explore findings, and the
implementation commits follow its order. → [`bc081aa`](https://github.com/Jasmine-G-uo/tablequeue/commit/bc081aa0d2f975cccb63015560ab1858e32b2323); the Explore → Plan → Implement → Commit
chain ends with [`635ad13`](https://github.com/Jasmine-G-uo/tablequeue/commit/635ad13ef82f59e6082a894cdf9428adb84b20be) (PR #6).

---

## 10. Test descriptions come first (issue #3)

We wrote criteria 1–8, shown below as written. Criteria 9–12 (party size, one active entry, wrong
role, staff list order) were drafted by Claude Code during a gap check against the PRD, and we
reviewed and approved them before any test was written.

```text
1	Queue number	The first guest to join on a business day gets number 1, and each new guest after that gets the day's highest number plus 1; numbers are unique per restaurant and business day, and a cancelled number is never reused.
2	Parties ahead	Parties ahead counts only the waiting entries from the same business day that have a smaller number, so called and finished entries don't count, and when someone ahead cancels, everyone behind them moves up by one.
3	Cancel	Only the guest who owns the entry can cancel it, either while it is waiting or called, and once it is cancelled its status can't change again.
4	Call next	When staff calls next, the waiting entry with the smallest number becomes called, and if nobody is waiting nothing changes and the result is queue_empty.
5	Seat / skip	Staff can seat or skip only an entry that is called, which turns it into seated or skipped.
6	Invalid status change	Any change that isn't in the status table, like acting on a finished entry or moving waiting straight to seated, fails with invalid_transition and leaves the entry as it was.
7	Someone else's entry	Trying to act on another guest's entry fails with not_found and changes nothing.
8	Entry from yesterday	A waiting or called entry left over from an earlier business day counts as expired: it isn't active, isn't counted in parties ahead, doesn't block the guest from joining again, and can't change status.
```

```text
[assistant] You wrote 8 descriptions. I kept your wording and changed only one thing:
  "business day" is now "service day", the term the PRD uses, so the tests and the spec use the
  same word. …
  Tests  12 todo (12)
  6bd1efa test(queue): add test descriptions from issue #3 as todos (#3)
```

**Annotation.** All 12 acceptance criteria became the test names, committed as `it.todo` before
any implementation existed, so every later red commit turns one of them into a real test. The only
wording change was _business day_ → _service day_, the PRD's term; the issue was updated to match,
so the issue and the test titles now read the same. → [`6bd1efa`](https://github.com/Jasmine-G-uo/tablequeue/commit/6bd1efae1adb62ecfa3b7004218152d9557518d3)

---

## 11. Red → green → refactor (queue domain)

```text
[assistant] **Queue cycle 4: staff list order (today's waiting and called entries, by queue number):**
      Tests  3 failed | 24 passed | 8 todo (35)        ← red
  TypeError: activeQueue is not a function
      Tests  27 passed | 8 todo (35)                   ← green
[assistant] Green. The status check `waiting || called` now appears twice (`canJoin` and
  `activeQueue`), so I'll commit green and then do one refactor:
  75:    .filter((e) => e.serviceDay === serviceDay && (e.status === "waiting" || e.status === "called"))
[assistant] The grep caught a miss: Prettier had joined that line, so my replacement didn't match
  it, and the refactor commit only covered half the duplication. I'll fix it and amend that commit:
  0
      Tests  27 passed | 8 todo (35)
  f1dadff refactor(queue): name the "still holds a place" statuses once (#3)

[Edit queue.test.ts] it("moves everyone behind up by one when someone ahead cancels", () => {
    const after = [{ ...e1, status: "cancelled" as const }, e2, e3];
    expect(queue.partiesAhead(after, e2.id, TODAY)).toBe(0);
    expect(queue.partiesAhead(after, e3.id, TODAY)).toBe(1); …
      Tests  5 failed | 27 passed | 7 todo (39)        ← red
  TypeError: partiesAhead is not a function
      Tests  32 passed | 7 todo (39)                   ← green
  c907663 feat(queue): [green] parties ahead derived from the active queue (#3)
```

**Annotation.** Each red run was checked to fail for the expected reason (the function didn't
exist yet, not a broken test), and the failing output went into the red commit's message. The
refactor ran only while green. A grep for leftover duplicates showed it was incomplete, so it
was finished before moving on. Red commits touch only the test file; green and refactor commits
touch only `queue.ts`. → red [`02b6db7`](https://github.com/Jasmine-G-uo/tablequeue/commit/02b6db7e89198c7e44f5fe65baea9f34486bb661), green [`c30e388`](https://github.com/Jasmine-G-uo/tablequeue/commit/c30e3889efce8f1633b8f403f86da7d54296766d), refactor [`f1dadff`](https://github.com/Jasmine-G-uo/tablequeue/commit/f1dadffde78e0237b4904aff728f21e2bc703046); red
[`7fb659d`](https://github.com/Jasmine-G-uo/tablequeue/commit/7fb659dbe915fff5b32b8d504326bffb3e63ef04), green [`c907663`](https://github.com/Jasmine-G-uo/tablequeue/commit/c907663049f1cdb59f10aedd5c3b8f258a49cc8c)

---

## 12. A mistake: tests green, typecheck red

```text
[assistant] The independent review is back. Before I report, I want to verify the most serious
  item myself, that typecheck fails. …
src/lib/queue/queue.ts(104,34): error TS2322: Type '"invalid_transition"' is not assignable to type '"invalid_party_size" | "already_in_queue"'.
src/lib/queue/queue.ts(117,43): error TS2322: Type '"queue_empty"' is not assignable to type '"invalid_party_size" | "already_in_queue"'.

fix(queue): add queue_empty and invalid_transition to QueueError (#3)
  The green commits 3cb57c6 (call next) and 1cb49ab (seat/skip) returned these codes, but the
  edit that widened the QueueError union did not apply after Prettier had joined the union onto
  one line. Vitest strips types, so the tests passed while `npm run typecheck` failed with TS2322
  at queue.ts:104 and :117. …
```

**Annotation.** An independent review caught what the tests could not: Vitest doesn't
typecheck, and two green commits had been checked with `npm test` only. Claude reproduced the
finding before acting on it. The fix is its own commit with the cause in the message, and
history was not rewritten. From then on, every commit ran the full self-check from `CLAUDE.md`
(lint, format, typecheck, tests). → [`ea15225`](https://github.com/Jasmine-G-uo/tablequeue/commit/ea152255953617f7e4f87f1b37f5e1a615c2eec6)

---

## 13. `/compact`, then continuing the same task

```text
<command-name>/compact</command-name>
<command-message>compact</command-message>
<local-command-stdout>Compacted PreCompact [<hook>] completed successfully
PostCompact [<hook>] completed successfully</local-command-stdout>

[from the compacted summary]
2. Key Technical Concepts:
   - Stack: Next.js 16.4.6 (App Router, src/, `cacheComponents: true`, `middleware`→`proxy`,
     session reads must sit behind `<Suspense>`) …
   - Lockfile must be generated with npm 11.19.1 to match CI, or the @emnapi optional deps go missing.
   - Domain design: Pure queue module; queue number is the only ordering key; service day passed in; Result<T> …

[assistant] I'm adding only the two codes the code already uses. `not_found` and `forbidden` will
  come in their own green commits.
```

After compacting, the remaining five criteria were finished in the same session:

```text
 × rejects waiting -> waiting and leaves the entry as it was
 × rejects called -> waiting and leaves the entry as it was
 × rejects called -> called and leaves the entry as it was
      Tests  3 failed | 68 passed | 3 todo (74)        ← red: 25-pair status-table test
      Tests  71 passed | 3 todo (74)                   ← green
…
      Tests  91 passed (91)                            ← all 12 criteria, no todos left
ERROR: Coverage for lines (100%) does not meet "src/lib/queue/**" threshold (101%)
                                                       ← proving the new 90% gate can fail a run
```

**Annotation.** The session was long, so `/compact` kept the technical thread (stack, domain
rules, open work) and dropped the noise. The work picked up at the exact next step: the type fix,
then the five remaining red → green cycles. The new coverage gate was checked by setting it above
the real value and watching the run fail, then setting it back to 90%. → [`ea15225`](https://github.com/Jasmine-G-uo/tablequeue/commit/ea152255953617f7e4f87f1b37f5e1a615c2eec6) …
[`a3fdd8f`](https://github.com/Jasmine-G-uo/tablequeue/commit/a3fdd8fd79d7d4963c917ffb24d8397e5c9438cf), gate [`4df34f5`](https://github.com/Jasmine-G-uo/tablequeue/commit/4df34f5775335504aac06bd2ab8e75c62b31e57c)

---

## 14. Review findings fixed test-first (auth)

```text
 × stays locked for 15 minutes after the 5th failure, not 15 minutes after the 1st
AssertionError: expected { ok: true, value: { …(3) } } to deeply equal { ok: false, …(1) }
      Tests  1 failed | 14 passed (15)                 ← red
      Tests  15 passed (15)                            ← green

 × checks at most 5 passwords even when 10 wrong attempts arrive at the same moment
AssertionError: expected 10 to be 5 // Object.is equality      ← red, reproduced on two runs
src/lib/auth/authenticate.ts(31,58): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
                                                       ← self-check caught this before the commit
      Tests  16 passed (16)                            ← green, three runs in a row
```

**Annotation.** An independent review flagged two security bugs in sign-in throttling. Each was
first proved with a failing test. The race test showed that ten parallel wrong passwords were
all checked, a real brute-force bypass. The fix serializes sign-ins per email with a PostgreSQL
advisory lock inside a transaction. This time the full self-check caught a type error before the
commit, which is the habit entry 12 set up. → lockout [`ad3eaad`](https://github.com/Jasmine-G-uo/tablequeue/commit/ad3eaad2f9fde9992321d4cac9f9e962fc545192) → [`cee70ae`](https://github.com/Jasmine-G-uo/tablequeue/commit/cee70ae98051e57288a636a5b3e711a38e526aae); race
[`4b20f79`](https://github.com/Jasmine-G-uo/tablequeue/commit/4b20f7944e470af9162cbcf531f111e0b67410c6) → [`b25863f`](https://github.com/Jasmine-G-uo/tablequeue/commit/b25863fba5a6ffdd7b603d3fea4604c989eb4fef)

---

## 15. Closing permission loopholes

```text
[Bash] git push origin HEAD:main --dry-run
  Permission to use Bash with command git push origin HEAD:main --dry-run has been denied.
[Bash] git checkout -- .
  Permission to use Bash with command git checkout -- . has been denied.
```

**Annotation.** Deny rules match by prefix, so `git push origin main` being blocked did not stop
`git push origin HEAD:main`. The review found these gaps, the rules were extended, and both new
rules were tested in a live session on a clean tree, where neither command could do harm.
Branch protection on `main`, which applies to admins too, stays the real backstop. → [`d0d2df4`](https://github.com/Jasmine-G-uo/tablequeue/commit/d0d2df438f87502e381b3afea251c67941218d22)

---

## Review

The other partner reviewed all four PRs before any merge. Two were approved with suggestions
(#6 auth, #7 queue) and two came back with changes requested (#5 setup, this PR). Every comment
got a fix commit or a reply giving the reason, in the form `Fixed in <full sha>`.

| PR        | Outcome           | Blocking finding                                                                                | Resolution                                                                                                                                                   |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #5 setup  | Changes requested | Repository admins could bypass the `main` protection, so a direct push would skip review and CI | "Do not allow bypassing" turned on; the API now reports enforcement for everyone (a repo setting)                                                            |
| #6 auth   | Approved          | —                                                                                               | —                                                                                                                                                            |
| #7 queue  | Approved          | —                                                                                               | —                                                                                                                                                            |
| #8 (docs) | Changes requested | The source of criteria 9–12 of #3 was not stated, and "word for word" overstated it             | Stated in entry 10, the reflection, and the README → [`5a17001`](https://github.com/Jasmine-G-uo/tablequeue/commit/5a17001002ca43ed1d20aab0676cf94fca075acc) |

Non-blocking suggestions and what happened to them:

- **#5:** more push and branch-deletion spellings and two more env files denied →
  [`6fa31d4`](https://github.com/Jasmine-G-uo/tablequeue/commit/6fa31d48e3b738ba2d3f542b30b1a9ee5687e5cf); the counter upsert in the plan had no conflict target, which PostgreSQL
  rejects → [`f3c9d66`](https://github.com/Jasmine-G-uo/tablequeue/commit/f3c9d66108a5464c6afc1ec0cdbffa5ea4bb04f9).
- **#6:** coverage gate for the unit-tested auth files → [`8b7fb2f`](https://github.com/Jasmine-G-uo/tablequeue/commit/8b7fb2f32678f6b2b61ead12a0e848f5459f8cf5); tests for `signInAction` →
  [`eaf7a34`](https://github.com/Jasmine-G-uo/tablequeue/commit/eaf7a34ab044996d4c6a609af6b0b808388d1cd9). Switching the sign-in lock to `pg_try_advisory_xact_lock` was tried and not
  adopted: the race test then checked 3 passwords instead of 5, so a burst never reached the
  lockout → reasoning in [`4c5c5e2`](https://github.com/Jasmine-G-uo/tablequeue/commit/4c5c5e2de69fefc3d2a6c7d630786f95e2676da5).
- **#7:** a 75-case status × target × actor table → [`309771f`](https://github.com/Jasmine-G-uo/tablequeue/commit/309771f0aeabc092087f756ed464ded54fd96b6e); the midnight, UTC-vs-local,
  and DST cases became criteria of issue #9 and the docs stopped claiming that coverage →
  [`e70e56d`](https://github.com/Jasmine-G-uo/tablequeue/commit/e70e56d2c04cb8e67fb6e20ab9a512981a24a90f); the optional `restaurantId` was kept, because dropping it would delete the test
  for part of criterion 1.

**Annotation.** The human review found what the agent's own reviews had missed: a repository
setting that no file in the repo shows, a SQL statement that would fail in PostgreSQL, and a claim
in these docs that the issue's edit history contradicted. Two suggestions would have meant
weakening or deleting a test, so they were checked against the tests and answered with the
evidence instead of being applied. Tests added after the code (the role table, `signInAction`)
were checked by temporarily breaking the code and watching them fail.
