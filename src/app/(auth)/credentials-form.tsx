"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

export function CredentialsForm({
  action,
  submitLabel,
  passwordAutoComplete,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={passwordAutoComplete}
          required
          minLength={8}
          className="rounded border px-3 py-2"
        />
      </label>
      <p role="alert" aria-live="polite" className="min-h-6 text-red-700">
        {state?.error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
