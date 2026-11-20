# Context management

A long session slowly fills with stale file dumps and old decisions, and answers get slower and
less precise. These rules keep each session focused.

| Situation                                       | Use                              | Why                                                                                    |
| ----------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| Starting a new issue or switching tasks         | `/clear`                         | The previous task's context only distracts; the repo and docs hold what matters        |
| A long task is still going but context is large | `/compact <what to keep>`        | Keeps the thread (e.g. "TDD progress, remaining todos, commit format") and drops noise |
| Resuming yesterday's or a just-closed session   | `claude --continue` / `--resume` | Picks up the exact conversation instead of re-explaining                               |
| Unsure how full the window is                   | `/context`                       | Shows what is using space before deciding to compact or clear                          |
| Wide search or an independent review            | A subagent                       | Its file reads stay out of the main context; only the conclusion comes back            |

## Durable memory lives in files, not in the chat

- Decisions go into `docs/PRD.md`, `docs/plan.md`, `docs/plans/<issue>.md`, and
  `docs/claude/*.md` as soon as they are made, so `/clear` never loses them.
- `CLAUDE.md` stays short and `@import`s the detailed files, so every session starts with the
  same rules without one huge file.
- Claude Code's auto-memory keeps cross-session facts about the project and team preferences.

## Habits

- One issue per session where possible; `/clear` between issues.
- Before `/compact`, make sure anything worth keeping is already committed or written to a plan
  file.
- After `--continue`, ask "where did we leave off and what is next?" to confirm the restored
  context before acting on it.
- Give subagents a self-contained brief (files to read, the question, the output format) because
  they do not see the main conversation.
