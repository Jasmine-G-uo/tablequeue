import { describe, it } from "vitest";

// Acceptance criteria from issue #2 (US-01).
describe("sign-in (PostgreSQL)", () => {
  it.todo(
    "Sign-in succeeds with correct credentials and fails with the single code `invalid_credentials` for both a wrong password and an unknown email.",
  );
  it.todo(
    "After 5 failed sign-ins for the same email within 15 minutes, further attempts for that email fail for 15 minutes, even with the correct password.",
  );
});
