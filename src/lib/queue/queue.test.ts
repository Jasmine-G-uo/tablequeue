import { describe, expect, it } from "vitest";
import * as queue from "./queue";
import type { Actor, QueueEntry } from "./queue";

const TODAY = "2026-11-20";
const YESTERDAY = "2026-11-19";
const NOW = new Date("2026-11-20T19:00:00Z");
const ANN = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const guestAnn: Actor = { role: "guest", userId: ANN };
const guestBob: Actor = { role: "guest", userId: BOB };
const staff: Actor = { role: "staff", userId: "33333333-3333-4333-8333-333333333333" };

let nextId = 0;
function entry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  nextId += 1;
  return {
    id: `entry-${nextId}`,
    restaurantId: "main",
    guestId: ANN,
    partySize: 2,
    serviceDay: TODAY,
    number: nextId,
    status: "waiting",
    joinedAt: new Date("2026-11-20T18:00:00Z"),
    statusChangedAt: new Date("2026-11-20T18:00:00Z"),
    ...overrides,
  };
}

// Acceptance criteria from issue #3, word for word. Each becomes a red -> green -> refactor cycle.
describe("queue domain", () => {
  describe("Queue number: The first guest to join on a service day gets number 1, and each new guest after that gets the day's highest number plus 1; numbers are unique per restaurant and service day, and a cancelled number is never reused.", () => {
    it("gives the first guest of the day number 1", () => {
      expect(queue.nextQueueNumber([], TODAY)).toBe(1);
    });

    it("gives the day's highest number plus 1", () => {
      const entries = [entry({ number: 1 }), entry({ number: 2 }), entry({ number: 3 })];
      expect(queue.nextQueueNumber(entries, TODAY)).toBe(4);
    });

    it("never reuses a cancelled or finished number, even the highest one", () => {
      const entries = [
        entry({ number: 1, status: "seated" }),
        entry({ number: 2, status: "cancelled" }),
      ];
      expect(queue.nextQueueNumber(entries, TODAY)).toBe(3);
    });

    it("starts again at 1 on a new service day", () => {
      const entries = [entry({ number: 7, serviceDay: YESTERDAY })];
      expect(queue.nextQueueNumber(entries, TODAY)).toBe(1);
    });

    it("counts only the given restaurant's entries", () => {
      const entries = [entry({ number: 5, restaurantId: "other" }), entry({ number: 2 })];
      expect(queue.nextQueueNumber(entries, TODAY, "main")).toBe(3);
    });
  });
  it.todo(
    "Parties ahead: Parties ahead counts only the waiting entries from the same service day that have a smaller number, so called and finished entries don't count, and when someone ahead cancels, everyone behind them moves up by one.",
  );
  it.todo(
    "Cancel: Only the guest who owns the entry can cancel it, either while it is waiting or called, and once it is cancelled its status can't change again.",
  );
  it.todo(
    "Call next: When staff calls next, the waiting entry with the smallest number becomes called, and if nobody is waiting nothing changes and the result is `queue_empty`.",
  );
  it.todo(
    "Seat / skip: Staff can seat or skip only an entry that is called, which turns it into seated or skipped.",
  );
  it.todo(
    "Invalid status change: Any change that isn't in the status table, like acting on a finished entry or moving waiting straight to seated, fails with `invalid_transition` and leaves the entry as it was.",
  );
  it.todo(
    "Someone else's entry: Trying to act on another guest's entry fails with `not_found` and changes nothing.",
  );
  it.todo(
    "Entry from yesterday: A waiting or called entry left over from an earlier service day counts as expired: it isn't active, isn't counted in parties ahead, doesn't block the guest from joining again, and can't change status.",
  );
  describe("Party size: Only whole numbers from 1 to 20 are accepted as a party size; anything else fails with `invalid_party_size`.", () => {
    it.each([1, 2, 20])("accepts %j", (size) => {
      expect(queue.validatePartySize(size)).toEqual({ ok: true, value: size });
    });

    it.each([0, 21, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, "3", " 3", null, undefined])(
      "rejects %j",
      (size) => {
        expect(queue.validatePartySize(size)).toEqual({
          ok: false,
          error: { code: "invalid_party_size" },
        });
      },
    );
  });
  it.todo(
    "One active entry: A guest who already has a waiting or called entry today can't join again and gets `already_in_queue` with their existing entry.",
  );
  it.todo(
    "Wrong role: A guest can't call, seat, or skip, and staff can't cancel on a guest's behalf; both fail with `forbidden` and change nothing.",
  );
  it.todo(
    "Staff list order: The active queue lists today's waiting and called entries in queue-number order, and parties ahead is derived from that same list.",
  );
});
