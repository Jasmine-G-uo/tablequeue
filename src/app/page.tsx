import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold">TableQueue</h1>
      <p>Join the restaurant&apos;s waitlist from your phone and see how many parties are ahead.</p>
      <nav className="flex gap-4">
        <Link href="/register" className="rounded bg-black px-4 py-2 text-white">
          Create an account
        </Link>
        <Link href="/sign-in" className="rounded border px-4 py-2">
          Sign in
        </Link>
      </nav>
    </main>
  );
}
