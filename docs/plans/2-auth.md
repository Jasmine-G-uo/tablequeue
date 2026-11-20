# Issue #2 — Guest registration and sign-in

## Explore findings

_Read-only exploration before any code. Sources: the repository, issue #2, `docs/PRD.md` §2, §5
(US-01), §6, `docs/plan.md`, and the Next.js docs bundled in `node_modules/next/dist/docs/`._

### What exists today

- `src/` contains only the scaffold (`app/layout.tsx`, `app/page.tsx`, `globals.css`). There is no
  `src/lib/`, no database code, no auth, and no `.env.example`.
- `vitest.config.mts` already has `unit` (node) and `integration` (node) projects; integration
  has no database setup yet.
- CI (`.github/workflows/ci.yml`) already provides a `postgres:17` service, a
  `DATABASE_URL` pointing at it, a throwaway `AUTH_SECRET`, and runs
  `npm run db:migrate --if-present` before integration tests — so this issue only has to add the
  script.
- `next.config.ts` enables `cacheComponents: true`.

### Next.js 16 facts that affect the design

- **`middleware` is now `proxy`** (`03-api-reference/03-file-conventions/proxy.md`). Route-level
  checks in `proxy` are an optimization only; the docs' "Data Access Layer" pattern verifies the
  session next to every data read.
- **Cache Components:** reading `cookies()` (any session read) outside a `<Suspense>` boundary is a
  **build error**, and plain `use cache` functions cannot read cookies
  (`02-guides/authentication-with-cache-components.md`). Session-reading UI must sit behind
  `<Suspense>`, and only a narrow user (`id`, `role`) should cross into cached code.
- The auth guide recommends an auth library and gives the recommended cookie options
  (`httpOnly`, `secure`, `sameSite: 'lax'`, explicit `expires`).

### Library options checked (npm registry, 2026-11-20)

| Package            | Version          | Next 16 support                   | Notes                                              |
| ------------------ | ---------------- | --------------------------------- | -------------------------------------------------- |
| `next-auth` (v5)   | `5.0.0-beta.32`  | peer `next ^14 \|\| ^15 \|\| ^16` | App Router–native (`auth()`, server actions)       |
| `next-auth` (v4)   | `4.24.15` latest | peer `next … ^16`                 | Stable, but Pages-era API                          |
| `pg` / `@types/pg` | `8.23.1`         | n/a                               | Pool supports interactive transactions (plan §2.3) |
| `bcryptjs`         | `3.0.3`          | n/a                               | Pure JS: no native build in CI or on Vercel        |

### Risks and unknowns

1. **Auth.js v5 is still beta.** Its Credentials provider only supports JWT sessions (no database
   sessions), so "sign-out clears the session" means clearing the cookie, and session lifetime is
   set with `session.maxAge`.
2. **Throttling** (5 failures / email / 15 min) is not built into Auth.js; it needs our own table
   and must run inside `authorize()` before the password check.
3. **Error codes through Auth.js:** `authorize()` returning `null` surfaces as a generic
   `CredentialsSignin` error, which matches the single `invalid_credentials` requirement — but the
   lockout must not reveal itself either, so it must return the same result.
4. **Testing Auth.js end to end** inside Vitest is awkward; the logic worth testing (validation,
   hashing, throttling, `authorize`, role guards) should live in plain functions that Auth.js
   calls, so they can be unit- and integration-tested without a running Next server.
5. **72-byte bcrypt limit:** bcrypt silently truncates longer passwords, so the length check must
   count UTF-8 **bytes**, not characters.
6. **Local database:** integration tests need PostgreSQL locally; nothing provides it yet.

### What this issue will touch

- New: `src/lib/db/` (pool, migrate runner), `db/migrations/001_users.sql`,
  `db/migrations/002_login_attempts.sql`, `src/lib/auth/` (validation, password, throttle,
  credentials, guards, Auth.js config), `src/app/api/auth/[...nextauth]/route.ts`, sign-up and
  sign-in pages under `src/app/(auth)/`, `.env.example`, `docker-compose.yml`, integration
  `globalSetup`.
- Changed: `package.json` (deps + `db:migrate`), `vitest.config.mts` (integration setup, env
  loading, auth coverage threshold).

## Plan

_Designed in Plan mode and approved before implementation._

### Decisions

| Topic           | Choice                                                                                                                                                                                | Why                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Auth library    | `next-auth@5.0.0-beta.32` (Auth.js), Credentials provider, JWT sessions, `maxAge` 8 h                                                                                                 | App Router–native; JWT is the only strategy Credentials supports   |
| DB access       | `pg` Pool (`src/lib/db/pool.ts`), parameterized SQL only                                                                                                                              | Interactive transactions needed later (plan §2.3); no ORM to learn |
| Migrations      | Plain SQL in `db/migrations/NNN_*.sql` + `scripts/migrate.mjs` (pg, records applied files in `schema_migrations`) → `npm run db:migrate`                                              | Zero extra deps; runs unchanged in CI                              |
| Hashing         | `bcryptjs` cost 12; length checked in UTF-8 **bytes** (8 chars min, 72 bytes max)                                                                                                     | Pure JS, no native build; avoids silent truncation                 |
| Throttling      | `login_attempts(email, attempted_at, succeeded)`; locked if ≥5 failures in the last 15 min after the last success                                                                     | DB-backed works across serverless instances                        |
| Testability     | All logic in plain functions; Auth.js `authorize()` is a 3-line adapter over `authenticate()`                                                                                         | Tests run without a Next server                                    |
| Guards          | `requireGuest/requireStaff(getSession)` return `{ ok: true, user }` or `{ ok: false, status: 401 \| 403, code }`; pages redirect to `/sign-in` on 401                                 | Matches PRD §6.2; session getter injected for tests                |
| Local DB        | `docker-compose.yml` (postgres:17 on host port 5433), `.env.example` listing `DATABASE_URL`, `AUTH_SECRET`; Claude writes `.env.local` with local-only values without reading it back | Real env files stay unreadable by policy                           |
| Integration env | `vitest.config.mts` integration project gets `globalSetup` (runs migrations) and loads `.env.local` via Vite `loadEnv`; each test truncates its tables                                | Fixes the known "can't reach DB" trap                              |

### Modules / files

- `src/lib/db/pool.ts`, `scripts/migrate.mjs`, `db/migrations/001_users.sql`
  (`id uuid default gen_random_uuid()`, `email text`, unique index on `lower(email)`,
  `password_hash`, `role text check (role in ('guest','staff'))`, `created_at`),
  `db/migrations/002_login_attempts.sql`
- `src/lib/auth/validation.ts` — `normalizeEmail`, `validateRegistration` → `invalid_email` / `invalid_password`
- `src/lib/auth/password.ts` — `hashPassword`, `verifyPassword`
- `src/lib/auth/users.ts` — `registerGuest` (→ `email_taken` on unique violation), `findUserByEmail`
- `src/lib/auth/throttle.ts` — `isLocked`, `recordAttempt`
- `src/lib/auth/authenticate.ts` — throttle → lookup → verify → record; always `invalid_credentials` on failure
- `src/lib/auth/guards.ts` — `requireGuest`, `requireStaff`
- `src/auth.ts` — `NextAuth({ providers: [Credentials], session: { strategy: "jwt", maxAge: 8h }, callbacks: id + role into token/session, pages.signIn })`; cookies HttpOnly/SameSite=Lax/Secure-in-prod (Auth.js defaults, asserted in a test of the config)
- `src/app/api/auth/[...nextauth]/route.ts`, `src/app/(auth)/register/page.tsx` + server action, `src/app/(auth)/sign-in/page.tsx`, sign-out server action; session-reading UI behind `<Suspense>`

### Commit sequence (TDD)

1. `docs(plan): implementation plan for auth (#2)` — this plan into `docs/plans/2-auth.md`
2. `chore(db): add local Postgres and env example (#2)` — `docker-compose.yml`, `.env.example`
3. `chore(db): add pg pool, migration runner, users and login_attempts tables (#2)` + integration globalSetup
4. For each acceptance criterion, `test(auth): add test descriptions from issue (#2)` (it.todo), then per criterion
   `test(auth): [red] …` (failing output in body) → `feat(auth): [green] …` → optional `refactor(auth): …`:
   normalization → validation codes → hashing → guest role + `email_taken` → sign-in success/`invalid_credentials`
   → lockout → guards 401/403 → session lifetime + cookie flags
5. `feat(auth): wire Auth.js config, route handler, register/sign-in pages, sign-out (#2)`
6. Push, open Auth PR (base `chore/1-project-setup`) with phase → commit table, AI disclosure, `Closes #2`

### Cut list if time runs short

Page styling (plain accessible forms only); sign-in page error polish; staff seed script stays in backlog (not in #2).

### Verification

- `npm run lint && npm run format:check && npm run typecheck && npm test`
- `docker compose up -d && npm run db:migrate && npm run test:integration` locally
- `npm run build` (catches Cache Components session-read errors)
- Manual smoke: `npm run dev`, register → sign in → sign out → protected page redirects
- CI green on the Auth PR (all six jobs)

## Review fixes (after the PR was opened)

An independent review of the branch found two security bugs and a crash. Each was fixed
test-first:

| Finding                                                                                                         | Red       | Green     |
| --------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| Lockout ended when the 1st failure aged out (≈15 min after it), not 15 min after the 5th                        | `ad3eaad` | `cee70ae` |
| 10 parallel wrong passwords were all checked: the lock check and the recorded attempt could interleave          | `4b20f79` | `b25863f` |
| Registration crashed (500) when the automatic sign-in failed, e.g. for an email locked before it was registered | `ef8a934` | `5faca13` |

- **Lock rule now:** locked while some failure in the last 15 minutes completes 5 failures within
  its own 15-minute window (failures before the last success don't count).
- **Serialization:** `authenticate()` runs in one transaction that starts with
  `pg_advisory_xact_lock(hashtext(email))`. Trade-off: a sign-in holds a pooled connection during
  bcrypt (~0.25 s), which is fine at one restaurant's scale.
- **Not fixed, by decision:** an unknown email skips bcrypt, so it answers faster than a wrong
  password. PRD US-01 already accepts that registration reveals whether an email exists
  (`email_taken`), so the timing difference reveals nothing new. Revisit if that trade-off changes.
