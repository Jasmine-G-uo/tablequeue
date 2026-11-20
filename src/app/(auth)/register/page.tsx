import Link from "next/link";
import { registerAction } from "../actions";
import { CredentialsForm } from "../credentials-form";

export const metadata = { title: "Create an account · TableQueue" };

export default function RegisterPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <CredentialsForm
        action={registerAction}
        submitLabel="Create account"
        passwordAutoComplete="new-password"
      />
      <p>
        Already registered?{" "}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
