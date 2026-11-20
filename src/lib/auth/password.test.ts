import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

// Acceptance criteria from issue #2 (US-01).
describe("password storage", () => {
  describe("Passwords are stored only as salted hashes.", () => {
    it("never returns the plain password and produces a bcrypt hash", async () => {
      const hash = await hashPassword("correct-horse");
      expect(hash).not.toContain("correct-horse");
      expect(hash).toMatch(/^\$2[aby]\$12\$/);
    });

    it("salts each hash, so the same password hashes differently", async () => {
      const [a, b] = await Promise.all([
        hashPassword("correct-horse"),
        hashPassword("correct-horse"),
      ]);
      expect(a).not.toBe(b);
    });

    it("verifies the right password and rejects a wrong one", async () => {
      const hash = await hashPassword("correct-horse");
      expect(await verifyPassword("correct-horse", hash)).toBe(true);
      expect(await verifyPassword("correct-horsf", hash)).toBe(false);
    });
  });
});
