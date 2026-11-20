import { describe, expect, it, vi } from "vitest";
import { guardPage, requireGuest, requireStaff, type SessionLike } from "./guards";

const guest: SessionLike = { user: { id: "11111111-1111-4111-8111-111111111111", role: "guest" } };
const staff: SessionLike = { user: { id: "22222222-2222-4222-8222-222222222222", role: "staff" } };
const session = (s: SessionLike | null) => async () => s;

// Acceptance criteria from issue #2 (US-01).
describe("role guards", () => {
  describe("`requireGuest` / `requireStaff` reject a request with no session (401) and a wrong role (403).", () => {
    it.each([
      ["requireGuest", requireGuest],
      ["requireStaff", requireStaff],
    ])("%s returns 401 unauthenticated with no session", async (_name, guard) => {
      expect(await guard(session(null))).toEqual({
        ok: false,
        status: 401,
        code: "unauthenticated",
      });
      expect(await guard(session({ user: undefined }))).toMatchObject({ status: 401 });
    });

    it("requireStaff returns 403 forbidden for a guest", async () => {
      expect(await requireStaff(session(guest))).toEqual({
        ok: false,
        status: 403,
        code: "forbidden",
      });
    });

    it("requireGuest returns 403 forbidden for staff", async () => {
      expect(await requireGuest(session(staff))).toMatchObject({ status: 403, code: "forbidden" });
    });

    it("returns only the id and role of the right user", async () => {
      expect(await requireGuest(session(guest))).toEqual({ ok: true, user: guest.user });
      expect(await requireStaff(session(staff))).toEqual({ ok: true, user: staff.user });
    });

    it("treats an unknown role as forbidden rather than trusting it", async () => {
      const odd = { user: { id: guest.user!.id, role: "admin" } } as unknown as SessionLike;
      expect(await requireGuest(session(odd))).toMatchObject({ status: 403 });
      expect(await requireStaff(session(odd))).toMatchObject({ status: 403 });
    });
  });

  describe("Protected pages redirect to sign-in when there is no session.", () => {
    it("redirects to /sign-in on 401", async () => {
      const redirect = vi.fn((url: string): never => {
        throw new Error(`redirect:${url}`);
      });
      await expect(guardPage(await requireGuest(session(null)), redirect)).rejects.toThrow(
        "redirect:/sign-in",
      );
    });

    it("sends a wrong-role user to /forbidden instead of signing them out", async () => {
      const redirect = vi.fn((url: string): never => {
        throw new Error(`redirect:${url}`);
      });
      await expect(guardPage(await requireStaff(session(guest)), redirect)).rejects.toThrow(
        "redirect:/forbidden",
      );
    });

    it("returns the user when allowed", async () => {
      const redirect = vi.fn((): never => {
        throw new Error("should not redirect");
      });
      await expect(guardPage(await requireGuest(session(guest)), redirect)).resolves.toEqual(
        guest.user,
      );
    });
  });
});
