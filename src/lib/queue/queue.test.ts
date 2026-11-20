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
  describe("Parties ahead: Parties ahead counts only the waiting entries from the same service day that have a smaller number, so called and finished entries don't count, and when someone ahead cancels, everyone behind them moves up by one.", () => {
    it("counts waiting entries with a smaller number", () => {
      const e1 = entry({ number: 1 });
      const e2 = entry({ number: 2 });
      const e3 = entry({ number: 3 });
      const all = [e3, e1, e2];
      expect(queue.partiesAhead(all, e1.id, TODAY)).toBe(0);
      expect(queue.partiesAhead(all, e2.id, TODAY)).toBe(1);
      expect(queue.partiesAhead(all, e3.id, TODAY)).toBe(2);
    });

    it("does not count called or finished entries", () => {
      const mine = entry({ number: 6 });
      const all = [
        entry({ number: 1, status: "called" }),
        entry({ number: 2, status: "seated" }),
        entry({ number: 3, status: "skipped" }),
        entry({ number: 4, status: "cancelled" }),
        entry({ number: 5 }),
        mine,
      ];
      expect(queue.partiesAhead(all, mine.id, TODAY)).toBe(1);
    });

    it("moves everyone behind up by one when someone ahead cancels", () => {
      const e1 = entry({ number: 1 });
      const e2 = entry({ number: 2 });
      const e3 = entry({ number: 3 });
      const after = [{ ...e1, status: "cancelled" as const }, e2, e3];
      expect(queue.partiesAhead(after, e2.id, TODAY)).toBe(0);
      expect(queue.partiesAhead(after, e3.id, TODAY)).toBe(1);
    });

    it("is null for an entry that is not waiting or not found", () => {
      const called = entry({ number: 1, status: "called" });
      expect(queue.partiesAhead([called], called.id, TODAY)).toBeNull();
      expect(queue.partiesAhead([called], "missing", TODAY)).toBeNull();
    });

    it("matches each waiting entry's position among waiting entries in the staff list", () => {
      const all = [
        entry({ number: 4 }),
        entry({ number: 1, status: "called" }),
        entry({ number: 2 }),
        entry({ number: 5, status: "seated" }),
        entry({ number: 3 }),
      ];
      const waiting = queue.activeQueue(all, TODAY).filter((e) => e.status === "waiting");
      waiting.forEach((e, index) => expect(queue.partiesAhead(all, e.id, TODAY)).toBe(index));
    });
  });
  it.todo(
    "Cancel: Only the guest who owns the entry can cancel it, either while it is waiting or called, and once it is cancelled its status can't change again.",
  );
  describe("Call next: When staff calls next, the waiting entry with the smallest number becomes called, and if nobody is waiting nothing changes and the result is `queue_empty`.", () => {
    it("calls the waiting entry with the smallest number", () => {
      const all = [
        entry({ number: 3 }),
        entry({ number: 1, status: "called" }),
        entry({ number: 2 }),
      ];
      const result = queue.callNext(all, staff, NOW, TODAY);
      expect(result).toMatchObject({ ok: true, value: { number: 2, status: "called" } });
      if (result.ok) expect(result.value.statusChangedAt).toEqual(NOW);
    });

    it("returns queue_empty and changes nothing when nobody is waiting", () => {
      const all = [entry({ number: 1, status: "called" }), entry({ number: 2, status: "seated" })];
      const before = structuredClone(all);
      expect(queue.callNext(all, staff, NOW, TODAY)).toEqual({
        ok: false,
        error: { code: "queue_empty" },
      });
      expect(all).toEqual(before);
    });

    it("does not modify the entries it was given", () => {
      const waiting = entry({ number: 1 });
      queue.callNext([waiting], staff, NOW, TODAY);
      expect(waiting.status).toBe("waiting");
    });
  });
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
  describe("One active entry: A guest who already has a waiting or called entry today can't join again and gets `already_in_queue` with their existing entry.", () => {
    it.each(["waiting", "called"] as const)("blocks a guest whose entry is %s", (status) => {
      const mine = entry({ guestId: ANN, status });
      expect(queue.canJoin([mine], ANN, TODAY)).toEqual({
        ok: false,
        error: { code: "already_in_queue", entry: mine },
      });
    });

    it.each(["seated", "skipped", "cancelled"] as const)(
      "lets a guest join again after a %s entry",
      (status) => {
        expect(queue.canJoin([entry({ guestId: ANN, status })], ANN, TODAY)).toEqual({
          ok: true,
          value: undefined,
        });
      },
    );

    it("is not blocked by another guest's active entry", () => {
      expect(queue.canJoin([entry({ guestId: BOB })], ANN, TODAY).ok).toBe(true);
    });
  });
  it.todo(
    "Wrong role: A guest can't call, seat, or skip, and staff can't cancel on a guest's behalf; both fail with `forbidden` and change nothing.",
  );
  describe("Staff list order: The active queue lists today's waiting and called entries in queue-number order, and parties ahead is derived from that same list.", () => {
    it("lists waiting and called entries by queue number, not by input order or join time", () => {
      const third = entry({ number: 3, joinedAt: new Date("2026-11-20T17:00:00Z") });
      const first = entry({ number: 1, status: "called" });
      const second = entry({ number: 2 });
      expect(queue.activeQueue([third, first, second], TODAY).map((e) => e.number)).toEqual([
        1, 2, 3,
      ]);
    });

    it("leaves out finished entries and other service days", () => {
      const list = queue.activeQueue(
        [
          entry({ number: 1, status: "seated" }),
          entry({ number: 2, status: "skipped" }),
          entry({ number: 3, status: "cancelled" }),
          entry({ number: 9, serviceDay: YESTERDAY }),
          entry({ number: 4 }),
        ],
        TODAY,
      );
      expect(list.map((e) => e.number)).toEqual([4]);
    });

    it("does not reorder the caller's array", () => {
      const input = [entry({ number: 2 }), entry({ number: 1 })];
      queue.activeQueue(input, TODAY);
      expect(input.map((e) => e.number)).toEqual([2, 1]);
    });
  });
});
