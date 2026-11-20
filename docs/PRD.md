# TableQueue — Product Requirements

- Status: Draft v1 (Sprint 1)
- Source: approved Project 3 proposal
- Last updated: 2026-11-20

## 1. Problem

Restaurant waitlists are hard to manage with paper lists and verbal updates. Guests have to ask
staff how many parties are ahead of them, and staff have to track cancellations and call the next
group by memory. TableQueue gives both sides one place to see and manage the queue.

## 2. Users and roles

| Role  | Who                              | How the account is created                                                                     |
| ----- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Guest | Walk-in guests of the restaurant | Self-registration (email + password). Every self-registered account is a guest.                |
| Staff | People working the host stand    | Created by a seed script from configuration. Staff accounts cannot be created through sign-up. |

TableQueue serves **one restaurant per deployment**, so there is exactly one waitlist. The data
model keeps a restaurant identifier so that multi-restaurant support stays possible later.

## 3. Goals, non-goals, anti-goals

**Goals**

- A guest can join the waitlist, see their place, and cancel without talking to staff.
- Staff can run the queue in arrival order from one screen.
- The queue state is always consistent: no party is lost, duplicated, or seated out of order by
  accident.

**Non-goals (out of scope)**

- Multiple restaurants, reservations, wait-time estimates, SMS/email notifications, table
  management, payments.

**Anti-goals (would count as failure even if it "works")**

- A guest can see or change another guest's entry.
- A guest can reach staff actions by guessing a URL or calling an API directly.
- The guest's displayed position disagrees with the staff view.

## 4. Queue model

### 4.1 Queue entry

Each entry records: guest, party size, queue number, status, joined-at time, and status-changed-at
time.

- **Party size:** integer from 1 to 20.
- **Queue number:** starts at 1 each service day (restaurant local date) and increases by 1 for
  each new entry that day. Numbers are never reused within a day.
- **One active entry per guest:** a guest can have at most one entry in `waiting` or `called`.

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

`seated`, `skipped`, and `cancelled` are final. Any transition not in this table is rejected with
an error and leaves the entry unchanged.

### 4.3 Parties ahead

For a `waiting` entry, **parties ahead** = the number of `waiting` entries that joined earlier the
same service day. Called, seated, skipped, and cancelled entries are not counted.

## 5. User stories and acceptance criteria

### US-01 Register and sign in (guest)

_As a guest, I want to register and sign in, so I can see and manage my own waitlist entry._

- [ ] A visitor can register with an email and a password; the new account has the guest role.
- [ ] Registration rejects an invalid email, a password shorter than 8 characters, and an email
      that is already registered, with a clear message.
- [ ] A registered user can sign in with correct credentials and is rejected with a generic message
      for wrong ones (the message does not reveal whether the email exists).
- [ ] A signed-in user can sign out; afterwards protected pages redirect to sign-in.
- [ ] Passwords are stored only as salted hashes, never in plain text.
- [ ] Guest pages require a signed-in guest; staff pages require a signed-in staff member. Both are
      enforced on the server.

### US-02 Join the waitlist (guest)

_As a guest, I want to enter my party size and receive a queue number, so I can join the
restaurant's waitlist._

- [ ] A signed-in guest with no active entry can join by entering a party size from 1 to 20.
- [ ] Party sizes outside 1–20 or not whole numbers are rejected with a message.
- [ ] The new entry is `waiting` and gets the next queue number for the service day (the first
      entry of the day gets 1).
- [ ] A guest who already has an active entry cannot join again and is shown their existing entry.

### US-03 See my status (guest)

_As a guest, I want to see how many parties are ahead of me and whether I have been called, so I
can follow my waiting status._

- [ ] The status page shows my queue number, party size, status, and (while `waiting`) parties
      ahead, computed as in §4.3.
- [ ] When staff call me, the page shows that I have been called without me doing anything (the
      page refreshes its data at least every 10 seconds).
- [ ] After my entry reaches a final state, the page shows the outcome and lets me join again.

### US-04 Cancel my entry (guest)

_As a guest whose plans change, I want to cancel my entry, so I no longer occupy a place in the
queue._

- [ ] I can cancel my own entry while it is `waiting` or `called`; it becomes `cancelled`.
- [ ] After I cancel, every guest who was behind me has one fewer party ahead.
- [ ] I cannot cancel an entry that is already final, or an entry that belongs to someone else.

### US-05 View the queue and call the next party (staff)

_As a restaurant staff member, I want to view waiting parties in arrival order and call the next
party, so I can manage the queue efficiently._

- [ ] The staff queue page lists today's `waiting` and `called` entries in arrival order with queue
      number, party size, status, and time joined.
- [ ] "Call next" changes the earliest `waiting` entry to `called`.
- [ ] "Call next" with no `waiting` entries does nothing and says the queue is empty.
- [ ] Guests cannot open the staff page or use staff actions.

### US-06 Seat or skip a party (staff)

_As a restaurant staff member, I want to mark a party as seated or skipped, so the queue stays
accurate._

- [ ] A `called` entry can be marked `seated` or `skipped`; both remove it from the active list.
- [ ] Seating or skipping an entry that is not `called` is rejected and changes nothing.
- [ ] A skipped guest can join again and receives a new queue number.

## 6. Non-functional requirements

- **Security (OWASP Top 10):** server-side authorization on every action (A01); hashed passwords
  and secure session cookies (A02/A07); parameterized queries only (A03); input validation on every
  request body (A03/A04); no secrets in the repository (A05); dependency audit in CI (A06).
- **Consistency:** two staff members pressing "Call next" at the same moment must not call the same
  entry twice; two simultaneous joins must not receive the same queue number.
- **Accessibility:** every form control has a label, all actions work with the keyboard, status
  changes are announced to screen readers, and text meets WCAG AA contrast.
- **Responsive:** guest pages are designed for phones first; the staff page works on a tablet.
- **Quality:** TDD for domain logic; CI must pass before merge.

## 7. Open items left to the builder

- Database access library, migration tool, and session strategy (decided in the auth plan, #2).
- Exact page layout and visual style.
- Which time zone defines the "service day" (default: the restaurant's configured time zone).
