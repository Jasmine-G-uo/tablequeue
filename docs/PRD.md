# TableQueue — Product Requirements

- Status: v2 (Sprint 1) — revised after [independent review](reviews/prd-review.md)
- Source: approved Project 3 proposal
- Last updated: 2026-11-20

## 1. Problem

Restaurant waitlists are hard to manage with paper lists and verbal updates. Guests have to ask
staff how many parties are ahead of them, and staff have to track cancellations and call the next
group by memory. TableQueue gives both sides one place to see and manage the queue.

## 2. Users and roles

| Role  | Who                              | How the account is created                                                            |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Guest | Walk-in guests of the restaurant | Self-registration (email + password). Every self-registered account is a guest.       |
| Staff | People working the host stand    | Created by the staff seed script (§6.3). Staff accounts cannot be created by sign-up. |

TableQueue serves **one restaurant per deployment**, so there is exactly one waitlist. Tables carry
a `restaurant_id` that is a single seeded constant; nothing in the UI or tests depends on more
than one restaurant.

## 3. Goals, non-goals, anti-goals

**Goals**

- A guest can join the waitlist, see their place, and cancel without talking to staff.
- Staff can run the queue in order from one screen.
- The queue state is always consistent: no party is lost, duplicated, or called twice.

**Non-goals (out of scope)**

- Multiple restaurants, reservations, wait-time estimates, SMS/email notifications, table
  management, payments.
- Staff removing or cancelling an entry on a guest's behalf (a no-show is handled by calling and
  then skipping).

**Anti-goals (would count as failure even if it "works")**

- A guest can see or change another guest's entry.
- A guest can reach staff actions by guessing a URL or calling an API directly.
- The guest's displayed position disagrees with the staff view.

## 4. Queue model

### 4.1 Queue entry

Each entry records: guest, party size, service day, queue number, status, joined-at time, and
status-changed-at time.

- **Service day:** the calendar date in the restaurant's configured time zone at the moment the
  entry is created.
- **Party size:** a JSON integer from 1 to 20. Strings (`"3"`), decimals (`3.5`), `null`, and
  missing values are rejected. (`3.0` is the same JSON number as `3` and is accepted.)
- **Queue number:** the first entry of a service day gets 1; each later entry that day gets the
  previous highest number + 1. Numbers are unique per (restaurant, service day) and never reused.
- **Order:** the queue number is the **only** ordering key. "Earlier", "ahead", "behind", and
  "arrival order" always mean "lower / higher queue number on the same service day".
- **Active entry:** an entry is active when its status is `waiting` or `called` **and** its service
  day is today. A guest can have at most one active entry.
- **Leftover entries:** `waiting` or `called` entries from an earlier service day are treated as
  expired. They are not active, are not shown to staff or counted in "parties ahead", do not block
  the guest from joining, and cannot be transitioned.

### 4.2 States

```
waiting ──call next──▶ called ──seat──▶ seated
   │                     │
   │                     └──skip──────▶ skipped
   │                     │
   └──guest cancels──▶ cancelled ◀──guest cancels
```

| From    | To        | Who                |
| ------- | --------- | ------------------ |
| waiting | called    | Staff              |
| waiting | cancelled | Guest (owner only) |
| called  | seated    | Staff              |
| called  | skipped   | Staff              |
| called  | cancelled | Guest (owner only) |

`seated`, `skipped`, and `cancelled` are final. Any transition not in this table, or by the wrong
actor, is rejected with `invalid_transition` (or `forbidden` for the wrong actor) and leaves the
entry unchanged. Every transition is applied only if the entry still has the expected current
status; if another request changed it first, the later request fails with `conflict` and changes
nothing.

More than one entry may be `called` at the same time.

### 4.3 Parties ahead

For a `waiting` entry, **parties ahead** = the number of `waiting` entries on the same service day
with a lower queue number. `called` and final entries are not counted.

## 5. User stories and acceptance criteria

Error results are named by code (e.g. `invalid_party_size`); exact wording is left to the UI.
HTTP mapping is in §6.2.

### US-01 Register and sign in (guest)

_As a guest, I want to register and sign in, so I can see and manage my own waitlist entry._

- [ ] A visitor can register with an email and a password; the new account has the guest role.
- [ ] Emails are trimmed and compared case-insensitively: `Ann@Example.com ` and `ann@example.com`
      are the same account.
- [ ] Registration rejects an invalid email (`invalid_email`), a password shorter than 8 characters
      or longer than 72 bytes (`invalid_password`), and an already-registered email
      (`email_taken`). Revealing that an email is registered is an accepted trade-off at this
      scope.
- [ ] Sign-in succeeds with correct credentials and fails with the single code
      `invalid_credentials` for both a wrong password and an unknown email.
- [ ] After 5 failed sign-ins for the same email within 15 minutes, further attempts for that email
      fail with `invalid_credentials` for 15 minutes, even with the correct password.
- [ ] Sign-out clears the session; protected pages then redirect to sign-in. Sessions expire after
      at most 8 hours.
- [ ] Passwords are stored only as salted hashes, never in plain text.
- [ ] Guest pages require a signed-in guest and staff pages require signed-in staff, enforced on
      the server (§6.2).

### US-02 Join the waitlist (guest)

_As a guest, I want to enter my party size and receive a queue number, so I can join the
restaurant's waitlist._

- [ ] A signed-in guest with no active entry can join with a valid party size (§4.1).
- [ ] An invalid party size is rejected with `invalid_party_size` and no entry is created.
- [ ] The new entry is `waiting` and gets the next queue number for today (the first entry of the
      day gets 1).
- [ ] A guest who already has an active entry cannot join (`already_in_queue`) and is shown their
      existing entry.
- [ ] Two join requests sent at the same moment by the same guest create exactly one entry.
- [ ] Join requests sent at the same moment by different guests always receive different queue
      numbers.

### US-03 See my status (guest)

_As a guest, I want to see how many parties are ahead of me and whether I have been called, so I
can follow my waiting status._

- [ ] With no active entry, the status page shows the join form.
- [ ] With an active entry, it shows my queue number, party size, status, and (while `waiting`)
      parties ahead as defined in §4.3.
- [ ] When staff call me, the page shows that I have been called without any action from me (it
      re-fetches at least every 10 seconds) and announces the change to screen readers.
- [ ] After my entry reaches a final state, the page shows the outcome and the join form.

### US-04 Cancel my entry (guest)

_As a guest whose plans change, I want to cancel my entry, so I no longer occupy a place in the
queue._

- [ ] I can cancel my own active entry while it is `waiting` or `called`; it becomes `cancelled`.
- [ ] If my entry was `waiting`, every `waiting` entry behind me has one fewer party ahead. If it
      was `called`, no one's parties-ahead count changes.
- [ ] Cancelling an entry that is already final fails with `invalid_transition`.
- [ ] The entry to cancel is identified from my session; trying to cancel someone else's entry
      fails with `not_found` and changes nothing.
- [ ] If staff seat or skip my entry at the same moment I cancel it, exactly one of the two
      succeeds and the other fails with `conflict`.

### US-05 View the queue and call the next party (staff)

_As a restaurant staff member, I want to view waiting parties in arrival order and call the next
party, so I can manage the queue efficiently._

- [ ] The staff queue page lists today's `waiting` and `called` entries ordered by queue number,
      with queue number, party size, status, and time joined.
- [ ] With no `waiting` or `called` entries, the page shows an empty-queue state.
- [ ] "Call next" changes the lowest-numbered `waiting` entry to `called`.
- [ ] "Call next" with no `waiting` entries changes nothing and returns `queue_empty`.
- [ ] Two "Call next" presses at the same moment call two different entries, or, if only one entry
      is waiting, one call succeeds and the other returns `queue_empty`.
- [ ] Guests cannot open the staff page or use staff actions (§6.2).

### US-06 Seat or skip a party (staff)

_As a restaurant staff member, I want to mark a party as seated or skipped, so the queue stays
accurate._

- [ ] A `called` entry can be marked `seated` or `skipped`; both remove it from the active list.
- [ ] Seating or skipping an entry that is not `called` fails with `invalid_transition` and
      changes nothing.
- [ ] A skipped guest can join again and receives a new queue number.

## 6. Non-functional requirements

### 6.1 Security (OWASP Top 10)

- **A01 Broken access control:** every action checks the session and role on the server; entry
  ownership always comes from the session, never from the request body.
- **A02 / A07 Crypto and authentication failures:** salted password hashes; sign-in throttling
  (US-01); session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production; sessions
  expire within 8 hours.
- **A03 Injection:** parameterized queries only; every request body is validated before use.
- **A04 Insecure design:** concurrency rules are enforced by the database (unique constraints and
  conditional updates), not by the UI.
- **A05 Security misconfiguration:** no secrets in the repository; the app refuses to start
  without required secrets.
- **A06 Vulnerable components:** `npm audit` runs in CI.
- **CSRF:** every state-changing request (join, cancel, call, seat, skip, sign-out) is protected by
  an Auth.js CSRF token or an origin check.

### 6.2 Denial behavior

| Situation                                   | Page                    | API / action             |
| ------------------------------------------- | ----------------------- | ------------------------ |
| Not signed in                               | Redirect to sign-in     | 401 `unauthenticated`    |
| Wrong role (guest on staff, staff on guest) | 403 page                | 403 `forbidden`          |
| Another guest's entry                       | —                       | 404 `not_found`          |
| Invalid transition                          | —                       | 409 `invalid_transition` |
| Lost a race                                 | —                       | 409 `conflict`           |
| Validation error                            | Form shows field errors | 400 with field codes     |

### 6.3 Staff seed script

Reads the staff email and password from environment variables, refuses to run if either is
missing or the password is shorter than 8 characters, hashes the password like a guest password,
and is idempotent: re-running it updates the existing staff account instead of creating a
duplicate.

### 6.4 Other qualities

- **Accessibility:** every form control has a label, all actions work with the keyboard, status
  changes are announced to screen readers, and text meets WCAG AA contrast.
- **Responsive:** guest pages are designed for phones first; the staff page works on a tablet.
- **Quality:** TDD for domain logic; CI must pass before merge.

## 7. Open items left to the builder

- Database access library, migration tool, and session strategy (decided in the auth plan, #2).
- Exact page layout, visual style, and message wording.
- Where the throttling counter is stored (database table is acceptable).

## 8. Change log

- **v2:** addressed the independent review — leftover entries from earlier days, queue number as
  the single ordering key, US-04 cancel cases, race outcomes, sign-in throttling and session
  lifetime, email normalization and password length, denial behavior, CSRF and cookie flags, staff
  seed rules, empty states, error codes, party-size parsing, and explicit non-goals.
- **v1:** initial draft from the proposal.
