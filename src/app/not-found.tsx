import Link from "next/link";
import type { Metadata } from "next";

// A 404 shouldn't be indexed, and shouldn't inherit a misleading page title.
export const metadata: Metadata = {
  title: { absolute: "Page not found — Locus" },
  robots: { index: false, follow: true },
};

/** Custom 404 — returns a proper 404 status (better than a soft-200) with a route back into the app. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p className="font-heading text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">This page doesn’t exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be broken or the page moved. Head back to the workspace.
      </p>
      <div className="mt-2 flex gap-3">
        <Link
          href="/"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Home
        </Link>
        <Link
          href="/capture"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Open Locus
        </Link>
      </div>
    </main>
  );
}
