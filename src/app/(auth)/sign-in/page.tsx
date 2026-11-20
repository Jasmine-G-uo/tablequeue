import Link from "next/link";
import { signInAction } from "../actions";
import { CredentialsForm } from "../credentials-form";

export const metadata = { title: "Sign in · TableQueue" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <CredentialsForm
        action={signInAction}
        submitLabel="Sign in"
        passwordAutoComplete="current-password"
      />
      <p>
        New here?{" "}
        <Link href="/register" className="underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
