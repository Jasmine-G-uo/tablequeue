"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { signOutToSignIn } from "@/lib/auth/config";
import { registerGuest } from "@/lib/auth/users";
import type { AuthErrorCode } from "@/lib/auth/validation";
import { getPool } from "@/lib/db/pool";

export type FormState = { error: string } | undefined;

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_email: "Enter a valid email address.",
  invalid_password: "Use a password of at least 8 characters (at most 72 bytes).",
  email_taken: "An account with this email already exists. Try signing in.",
  invalid_credentials: "Email or password is incorrect.",
};

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const result = await registerGuest(getPool(), { email, password });
  if (!result.ok) return { error: MESSAGES[result.error.code] };
  // signIn redirects on success by throwing Next's redirect signal, so nothing runs after it.
  await signIn("credentials", { email, password, redirectTo: "/account" });
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/account",
    });
  } catch (error) {
    // Any credentials failure, including a lockout, gets the same message (PRD US-01).
    if (error instanceof AuthError) return { error: MESSAGES.invalid_credentials };
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOutToSignIn(signOut);
}
