import { describe, expect, it } from "vitest";
import { normalizeEmail, validateRegistration } from "./validation";

// Acceptance criteria from issue #2 (US-01).
describe("registration input", () => {
  it("Emails are trimmed and compared case-insensitively, so `Ann@Example.com ` and `ann@example.com` are the same account.", () => {
    expect(normalizeEmail("Ann@Example.com ")).toBe("ann@example.com");
    expect(normalizeEmail("  ann@example.com")).toBe(normalizeEmail("ANN@EXAMPLE.COM"));
  });

  describe("Registration rejects an invalid email (`invalid_email`), a password shorter than 8 characters or longer than 72 bytes (`invalid_password`).", () => {
    it("accepts a valid email and password and returns the normalized email", () => {
      expect(
        validateRegistration({ email: " Ann@Example.com", password: "correct-horse" }),
      ).toEqual({ ok: true, value: { email: "ann@example.com", password: "correct-horse" } });
    });

    it.each(["", "ann", "ann@", "@example.com", "ann@example", "ann @example.com", 42, null])(
      "rejects email %j with invalid_email",
      (email) => {
        expect(validateRegistration({ email, password: "correct-horse" })).toEqual({
          ok: false,
          error: { code: "invalid_email" },
        });
      },
    );

    it("rejects a password shorter than 8 characters", () => {
      expect(validateRegistration({ email: "ann@example.com", password: "short7!" })).toEqual({
        ok: false,
        error: { code: "invalid_password" },
      });
    });

    it("accepts exactly 72 bytes and rejects 73 bytes, counting UTF-8 bytes not characters", () => {
      const ascii72 = "a".repeat(72);
      expect(validateRegistration({ email: "ann@example.com", password: ascii72 }).ok).toBe(true);
      expect(validateRegistration({ email: "ann@example.com", password: ascii72 + "a" })).toEqual({
        ok: false,
        error: { code: "invalid_password" },
      });
      // 25 × "é" is 25 characters but 50 bytes; 37 × "é" is 74 bytes.
      expect(validateRegistration({ email: "ann@example.com", password: "é".repeat(25) }).ok).toBe(
        true,
      );
      expect(validateRegistration({ email: "ann@example.com", password: "é".repeat(37) })).toEqual({
        ok: false,
        error: { code: "invalid_password" },
      });
    });

    it("rejects a non-string password", () => {
      expect(validateRegistration({ email: "ann@example.com", password: 12345678 })).toEqual({
        ok: false,
        error: { code: "invalid_password" },
      });
    });
  });
});
