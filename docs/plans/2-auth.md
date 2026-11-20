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
