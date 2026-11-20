import { AuthError } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const registerGuest = vi.fn();
// next-auth itself does not load under Vitest (it imports "next/server" without an extension), so
// the test and actions.ts share this stand-in AuthError class.
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/auth", () => ({ signIn, signOut: vi.fn() }));
vi.mock("@/lib/auth/users", () => ({ registerGuest }));
vi.mock("@/lib/db/pool", () => ({ getPool: vi.fn() }));

const { registerAction } = await import("./actions");

function form(email: string, password: string): FormData {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

beforeEach(() => {
  signIn.mockReset();
  registerGuest.mockReset();
});

// Acceptance criteria from issue #2 (US-01).
describe("A visitor can register with an email and a password; the new account has the guest role.", () => {
  it("asks the new guest to sign in when the automatic sign-in fails, instead of crashing", async () => {
    // e.g. someone already locked this email with 5 wrong passwords before it was registered
    registerGuest.mockResolvedValue({ ok: true, value: { id: "u1", role: "guest" } });
    signIn.mockRejectedValue(new AuthError("CredentialsSignin"));
    expect(await registerAction(undefined, form("ann@example.com", "correct-horse"))).toEqual({
      error: "Your account was created. Please sign in.",
    });
  });

  it("does not swallow other errors, such as Next's redirect signal", async () => {
    registerGuest.mockResolvedValue({ ok: true, value: { id: "u1", role: "guest" } });
    const redirect = new Error("NEXT_REDIRECT");
    signIn.mockRejectedValue(redirect);
    await expect(registerAction(undefined, form("ann@example.com", "correct-horse"))).rejects.toBe(
      redirect,
    );
  });
});
