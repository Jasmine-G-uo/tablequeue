# PRD review — 2026-11-20

Reviewer: independent Claude Code subagent (no shared context with the author session)

## Summary

The PRD is tight, well scoped, and its state machine is explicit, so most criteria are close to
testable. Before tests are written, it needs four things: what happens at the day boundary,
one canonical definition of arrival order, defined outcomes for concurrent actions, and a fix for
US-04's "one fewer party ahead" criterion, which contradicts §4.3 when the cancelled entry was
`called`. A few security details (brute-force limits, CSRF, cookie flags, error codes) should be
pinned down so they can be tested too.

## Findings

1. **must-fix — §4.1, §4.3, US-02, US-05: entries left over from a previous service day.**
   A guest whose entry is still `waiting`/`called` at the end of the day keeps an "active" entry
   that the staff page (which lists only "today's" entries) never shows. That guest can never be
   called and, under the one-active-entry rule, can never join again.
   _Fix:_ State a rule, e.g. "Active entries from earlier service days are treated as expired: they
   are not counted as active, not shown to staff, and do not block joining" (or a nightly job moves
   them to a final `expired` state, which would also need adding to §4.2). Add an AC with a fixed
   clock crossing local midnight.

2. **must-fix — §4.3, US-05, §6: "arrival order" is defined two ways.** §4.3 uses "joined
   earlier" (a timestamp), while queue numbers also encode order. Two joins in the same
   millisecond, or clock skew, make "earliest `waiting`" and "parties ahead" ambiguous.
   _Fix:_ Make the queue number the single ordering key everywhere: "parties ahead = count of
   `waiting` entries in the same service day with a lower queue number"; "Call next" picks the
   lowest-numbered `waiting` entry.

3. **must-fix — US-04 vs §4.3: "every guest behind me has one fewer party ahead" is false when I
   was `called`.** Called entries are not counted in parties ahead, so cancelling one changes
   nobody's count.
   _Fix:_ Reword to: "If my entry was `waiting`, every `waiting` entry behind me has one fewer
   party ahead; if it was `called`, other counts do not change." Write one test for each case.

4. **must-fix — §6 Consistency, US-04, US-06: race outcomes are not specified.** "Must not call the
   same entry twice" does not say what the second concurrent "Call next" does (call the next
   entry, or report a conflict?). Also missing: a guest cancelling while staff seat or skip the same
   `called` entry, and a guest double-submitting "Join" (the one-active-entry rule under concurrency).
   _Fix:_ Add ACs. (a) Two simultaneous "Call next" presses call two different entries, or the
   second reports empty if only one is waiting. (b) Every transition is a conditional update on the
   current status; the losing request gets a conflict error and changes nothing. (c) Two
   simultaneous joins by the same guest create exactly one entry, enforced by a DB constraint such
   as a partial unique index on (guest, active status). (d) Queue numbers are unique per
   (restaurant, service day), enforced by a unique constraint.

5. **must-fix — US-01, §6 A07: no protection against brute-force or credential stuffing.**
   Without limits, sign-in is open to password guessing, and the staff accounts are the high-value
   target.
   _Fix:_ Add an AC such as "After 5 failed sign-ins for one email or IP within 15 minutes, further
   attempts are refused for 15 minutes with the same generic message." Also give sessions a
   maximum lifetime and invalidate the session server-side on sign-out.

6. **should-fix — US-01: registration reveals which emails exist, which undercuts the sign-in
   rule.** "Email already registered" lets anyone check whether an email has an account, which is
   exactly what the generic sign-in message is meant to hide.
   _Fix:_ Either accept this trade-off explicitly in the PRD (common and reasonable for this
   scope) or use a generic "could not register" response. Also define email normalization
   (trim + case-insensitive uniqueness) and a maximum password length (e.g. 72 bytes for bcrypt),
   so the duplicate-email and password tests are deterministic.

7. **should-fix — US-01, US-05, §6 A01: denial behavior is not specified.** "Redirect to
   sign-in", "cannot open the staff page" and "rejected" do not say whether a page redirects or an
   API returns 401, 403 or 404, or what a staff member sees on guest pages.
   _Fix:_ State: unauthenticated page request → redirect to sign-in; unauthenticated API call →
   401; wrong role → 403 (pages and API); acting on another guest's entry → 404 (avoids confirming
   the entry exists); invalid transition → 409; validation error → 400 with field errors. Require
   that the cancel action takes the owner from the session, never from the request body.

8. **should-fix — §6 Security: CSRF and cookie attributes are not stated.** Mutations (join,
   cancel, call, seat, skip) are state-changing and cookie-authenticated.
   _Fix:_ Require HttpOnly, Secure (in production) and SameSite=Lax or Strict session cookies, plus
   CSRF protection on every mutation (Auth.js CSRF token or origin check). Make each requirement a
   test.

9. **should-fix — §2, §6 A05: staff seed credentials.** "Created by a seed script from
   configuration" does not forbid a default or weak staff password, and it does not say whether
   re-running the seed duplicates accounts or resets passwords.
   _Fix:_ The seed reads credentials from environment variables, refuses to run if they are
   missing or shorter than the password minimum, hashes them like guest passwords, and is
   idempotent (upsert by email).

10. **should-fix — US-02, US-03, US-05: empty states and vague wording.** "A clear message",
    "with a message" and "says the queue is empty" cannot be asserted as written. The status page
    with no entry ever, and the staff page with nothing waiting or called, have no defined content.
    Nor does the PRD say whether staff may call another party while one is already `called`.
    _Fix:_ Specify the observable result (an error code or field key, not exact copy) and add
    ACs for: guest status page with no entry (shows the join form), empty staff list (shows an
    empty-state message), and multiple `called` entries (allowed; all are listed in queue-number
    order).

11. **nit — US-02: what counts as a valid party size.** Say whether `"3"`, `3.0`, `" 3 "` and
    `null` are accepted. Suggest: accept only JSON integers 1–20; reject everything else with 400.

12. **nit — §2, §3 scope: restaurant identifier and staff-side removal.** Keeping a
    `restaurant_id` goes beyond the six stories. That is harmless if it is a single seeded constant
    with no tests or UI around it, so say so. Separately, staff cannot remove a `waiting` no-show
    or cancel for a guest. That is consistent with §4.2 but should be listed as a non-goal so
    nobody adds it.

## What is solid

- The state machine (§4.2) lists every allowed transition and who may perform it, and says
  everything else is rejected with no change, which translates directly into a table of tests.
- The anti-goals are concrete and testable as security tests (IDOR, forced browsing,
  guest/staff view mismatch).
- The scope is disciplined. The non-goals explicitly exclude notifications, estimates and
  multi-restaurant support, and each AC maps to one of the six stories.
- Server-side enforcement and parameterized queries are stated as requirements, not left to the
  builder's judgment.
