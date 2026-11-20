# Security rules

## OWASP Top 10 (2021) in this app

| Risk                          | What we do                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken access control     | `requireGuest` / `requireStaff` in every server action and route handler; ownership from the session only; another guest's entry → 404 |
| A02 Cryptographic failures    | Salted password hashes (bcrypt/argon2); HTTPS only in production; no secrets in logs                                                   |
| A03 Injection                 | Parameterized SQL only; validate every request body before use; no string-built queries                                                |
| A04 Insecure design           | Concurrency enforced by the database (counter row, unique indexes, compare-and-set)                                                    |
| A05 Security misconfiguration | No secrets in the repo; the app refuses to start without required env vars; secure cookie flags                                        |
| A06 Vulnerable components     | `npm audit --audit-level=high` in CI; upgrade instead of ignoring                                                                      |
| A07 Authentication failures   | Generic `invalid_credentials`; 5 failures per email per 15 min locks sign-in for 15 min; 8 h sessions                                  |
| A08 Integrity failures        | Lockfile committed; CI installs with `npm ci`; branch protection on `main`                                                             |
| A09 Logging failures          | Log auth failures and denied actions without passwords or tokens                                                                       |
| A10 SSRF                      | The app makes no server-side requests to user-supplied URLs                                                                            |

Plus **CSRF**: every state-changing request is protected by the Auth.js CSRF token or an origin
check; session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

## Security acceptance criteria in the Definition of Done

A change that touches auth, data access, or user input is done only when:

- [ ] Unauthenticated and wrong-role requests are tested and rejected (401 / 403).
- [ ] Acting on another user's data is tested and rejected without leaking that it exists.
- [ ] All new input is validated, with a test for at least one invalid value.
- [ ] No secret, password, or token appears in code, logs, fixtures, or commit messages.
- [ ] `npm audit` shows no new high or critical issue.

## Secrets and environment files

- Real values live only in `.env.local` (local) and the hosting provider's settings. Both are
  git-ignored.
- Claude Code cannot read real env files (`.claude/settings.json` denies them). Every variable
  the app needs is listed with a placeholder in `.env.example`, and a human copies it to
  `.env.local` and fills it in.
- CI uses throwaway values set in the workflow file, never production secrets.

## Guardrails are layered

The same rules appear in three places, so one missing layer does not open a hole:

1. **This documentation** tells the agent what not to do (stage files by name, never force-push,
   never read secrets).
2. **`.claude/settings.json` deny rules** block the obvious commands (`git add -A`,
   `git push --force`, `rm -rf`, reading `.env.local`). They match by prefix, so a rephrased
   command can slip past, and a shell command can read a file that the `Read` rule blocks.
3. **GitHub branch protection** is the real backstop: nothing reaches `main` without a pull
   request, a passing CI run, and a partner's approval, whatever happens locally.
