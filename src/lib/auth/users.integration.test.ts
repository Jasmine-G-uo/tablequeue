import { describe, it } from "vitest";

// Acceptance criteria from issue #2 (US-01).
describe("guest registration (PostgreSQL)", () => {
  it.todo(
    "A visitor can register with an email and a password; the new account has the guest role.",
  );
  it.todo("Registration rejects an already-registered email (`email_taken`).");
});
