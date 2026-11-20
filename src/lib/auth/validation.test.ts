import { describe, it } from "vitest";

// Acceptance criteria from issue #2 (US-01).
describe("registration input", () => {
  it.todo(
    "Emails are trimmed and compared case-insensitively, so `Ann@Example.com ` and `ann@example.com` are the same account.",
  );
  it.todo(
    "Registration rejects an invalid email (`invalid_email`), a password shorter than 8 characters or longer than 72 bytes (`invalid_password`).",
  );
});
