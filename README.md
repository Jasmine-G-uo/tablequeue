# TableQueue

A digital waitlist for small restaurants. Guests join the queue, see how many parties are ahead of
them, and cancel if their plans change. Staff see waiting parties in arrival order, call the next
party, and mark parties as seated or skipped.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Auth.js · Vercel

## Getting started

```bash
nvm use          # Node 24
npm ci
npm run dev      # http://localhost:3000
```

## Scripts

| Command                    | What it does                       |
| -------------------------- | ---------------------------------- |
| `npm run dev`              | Start the dev server               |
| `npm run build`            | Production build                   |
| `npm run lint`             | ESLint                             |
| `npm run format:check`     | Prettier check                     |
| `npm run typecheck`        | `next typegen && tsc --noEmit`     |
| `npm test`                 | Unit tests (Vitest, node)          |
| `npm run test:integration` | Integration tests (Vitest, node)   |
| `npm run test:coverage`    | Unit tests with coverage (src/lib) |

## How we work

- Product spec: [docs/PRD.md](docs/PRD.md) · architecture and delivery plan: [docs/plan.md](docs/plan.md)
- Team workflow, TDD rules, and security rules: [docs/claude/](docs/claude/) (imported by
  [CLAUDE.md](CLAUDE.md))
- CI (GitHub Actions) runs lint, typecheck, unit tests with coverage, integration tests against
  PostgreSQL, build, and `npm audit` on every pull request. Deployment (CD to Vercel) is planned
  for a later P3 sprint and is not set up yet.
