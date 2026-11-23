import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { guardPage, requireGuest } from "@/lib/auth/guards";
import { signOutAction } from "../../(auth)/actions";

export const metadata = { title: "Your account · TableQueue" };

export default function AccountPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Your account</h1>
      {/* Reading the session is request-time data, so it must sit behind Suspense (Next 16). */}
      <Suspense fallback={<p>Loading…</p>}>
        <SignedInGuest />
      </Suspense>
    </main>
  );
}

async function SignedInGuest() {
  await guardPage(await requireGuest(() => auth()), redirect);
  return (
    <>
      <p>You are signed in as a guest. Joining the waitlist arrives in the next sprint.</p>
      <form action={signOutAction}>
        <button type="submit" className="rounded border px-4 py-2">
          Sign out
        </button>
      </form>
    </>
  );
}
