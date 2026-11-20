# Sprint 1

- Dates: 2026-11-20 → 2026-12-02 (internal planning target; Canvas sets the official deadlines).
- Milestone: [Sprint 1](https://github.com/Jasmine-G-uo/tablequeue/milestone/1)
- Board: [TableQueue project](https://github.com/users/Jasmine-G-uo/projects/1) — Backlog → Sprint Todo → In Progress → In Review → Done.
- Roles: Product Owner — Jiaying; Scrum Master — Chengling (swapped from Project 2).

## Planning

**Sprint goal:** a shared, enforceable foundation (spec, plan, Claude Code rules, permissions, CI)
plus the first two independent modules — guest accounts and the queue domain rules — built
test-first.

| Issue | Title                                                       | Points | Priority | Branch                   |
| ----- | ----------------------------------------------------------- | ------ | -------- | ------------------------ |
| #1    | Set up project spec, Claude Code rules, permissions, and CI | 3      | high     | `chore/1-project-setup`  |
| #2    | Guest registration and sign-in                              | 5      | high     | `feature/2-auth`         |
| #3    | Queue domain logic (TDD)                                    | 5      | high     | `feature/3-queue-domain` |
| #4    | HW4 session log and reflection                              | 2      | medium   | `docs/4-hw4-reflection`  |

Total: 15 points.

Dependencies: #2, #3, and #4 branch from #1 and do not depend on each other, so they can be
reviewed in any order once #1 is approved.

Working agreement for the sprint:

- One branch and one focused pull request per issue; the other partner reviews before merge.
- Acceptance criteria in each issue are the failing tests to start from; an issue closes only when
  all of them pass in CI.
- Standups are posted asynchronously in the course Slack channel: at least three per partner during
  the sprint, each with Done / Next / Blockers and links.

## Standups

| Date (PT) | Posted by | Summary | Link |
| --------- | --------- | ------- | ---- |
|           |           |         |      |

## Review

_To be filled in at the end of the sprint._

## Retrospective

_To be filled in at the end of the sprint: what went well, what to improve, action items with
owners, and feedback for each partner._
