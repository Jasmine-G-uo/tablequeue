import Link from "next/link";

export const metadata = { title: "Not allowed · TableQueue" };

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">You don&apos;t have access to this page</h1>
      <p>This page is for a different kind of account.</p>
      <Link href="/" className="underline">
        Go to the home page
      </Link>
    </main>
  );
}
