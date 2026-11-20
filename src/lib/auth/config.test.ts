import { describe, it } from "vitest";

// Acceptance criteria from issue #2 (US-01).
describe("session configuration", () => {
  it.todo("Sessions expire after at most 8 hours.");
  it.todo("Session cookies are HttpOnly, SameSite=Lax, and Secure in production.");
  it.todo("Sign-out clears the session.");
});
