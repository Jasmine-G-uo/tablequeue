# Testing strategy

## TDD is mandatory

Every behavior change is built red → green → refactor:

1. **Descriptions first.** The issue's acceptance criteria are the test descriptions, written by
   the team. Commit them unchanged as `it.todo(...)` before any implementation:
   `test(<scope>): add test descriptions from issue (#n)`.
2. **Red.** Turn one todo into a real test, run it, and confirm it fails for the expected reason.
   Commit `test(<scope>): [red] <behavior> (#n)` with the failing output in the commit body.
3. **Green.** Write the minimum code that passes. Commit `feat(<scope>): [green] <behavior> (#n)`.
4. **Refactor** while green, when there is something worth improving:
   `refactor(<scope>): <what> (#n)`.
5. Repeat for every acceptance criterion. An issue is done only when all of its criteria pass in
   CI.

Never write implementation before a failing test exists for it, never weaken or delete a test to
make it pass, and never mark a criterion done without a test that proves it.

## Test pyramid

| Level       | Tool                         | Scope                                                                          |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------ |
| Unit        | Vitest `unit` project (node) | Domain rules, validation, auth helpers, components (jsdom opt-in)              |
| Integration | Vitest `integration` project | Migrations, auth flows, queue-service against real PostgreSQL, race conditions |
| E2E         | Playwright (later sprint)    | Guest and staff happy paths in a browser                                       |

## Rules for good tests

- Name tests by behavior, in the words of the acceptance criterion.
- Inject time: pass `now` and the service day; never read the system clock inside the domain.
- Cover edge cases from the PRD: the first entry of the day, empty queue, midnight boundary,
  leftover entries, wrong role, someone else's entry, every invalid transition (table test over
  status × target × role).
- Race tests use two pooled connections fired with `Promise.all` and assert exactly one winner.
- No snapshot tests for logic; assert observable results and error codes.

## Coverage

Coverage counts `src/lib/**`. Each module adds its own threshold line in `vitest.config.mts`
(`"src/lib/queue/**"`: at least 70%, aim for ~90% branches). CI fails below the threshold.

## Self-check before every commit

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
```

Add `npm run test:integration` when the change touches the database or auth.
