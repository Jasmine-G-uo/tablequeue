# Team workflow

## Sprints

- Work is planned in sprints (milestones "Sprint 1", "Sprint 2"); records live in
  `docs/process/sprint-<n>.md` (planning, standups, review, retrospective).
- Board columns: Backlog → Sprint Todo → In Progress → In Review → Done. Move a card only when its
  real state changes.
- Each partner posts at least three async standups per sprint in the course Slack channel
  (Done / Next / Blockers, with links).
- Product Owner and Scrum Master roles swap every sprint.

## Issues are testable specifications

Every issue has a Goal, an **Acceptance criteria** checklist, Planning (milestone, points,
priority, PRD references), and Delivery notes. Acceptance criteria must be specific enough to
become failing tests. Vague issues ("add search") are rewritten before work starts.

## From issue to merge

1. **Branch** from current `main` (or from the branch it stacks on): one branch per issue.
2. **Explore** the relevant code and docs without editing; write findings to
   `docs/plans/<n>-<slug>.md` and commit them (`docs(explore): …`).
3. **Plan** in Plan mode; add the approved plan to the same file and commit it (`docs(plan): …`)
   before writing code.
4. **Implement** test-first (see `testing.md`), running the self-check before each commit.
5. **Open a PR** with the template: what changed, how it was validated, the phase → commit table
   for Explore/Plan/Implement/Commit, and the AI disclosure. Use `Closes #n` only when every
   criterion passes.
6. **CI** must be green. Do not skip, weaken, or disable a check to get green.
7. **Review:** the other partner reviews. Address every comment with a fix commit or a reply, and
   answer with `Fixed in <full sha>`. Never self-approve.
8. **Merge** with a merge commit (squash and rebase are disabled, so TDD history survives). Before
   merging a stacked PR, merge the latest `main` into it and wait for CI.

## Pull request AI disclosure

Every PR states: the AI tool used, roughly what share of the diff was AI-generated, and what human
review was applied.

## Conflicts and links

- `package-lock.json` conflicts: take `main`'s version, then run `npm install` and commit the
  result.
- Link commits with full SHAs (`https://github.com/<owner>/tablequeue/commit/<sha>`), never branch
  links; merge commits keep SHAs stable after branches are deleted.
