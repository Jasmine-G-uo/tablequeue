import { describe, it } from "vitest";

// Acceptance criteria from issue #2 (US-01).
describe("role guards", () => {
  it.todo(
    "`requireGuest` / `requireStaff` reject a request with no session (401) and a wrong role (403).",
  );
  it.todo("Protected pages redirect to sign-in when there is no session.");
});
