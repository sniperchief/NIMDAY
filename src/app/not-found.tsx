import Link from "next/link";

/**
 * Any unknown URL. `/b/<slug>` has its own, warmer version — this is the
 * catch-all, and it still never says anything about why (a mistyped link and
 * an unpublished nimDay look identical from outside, deliberately).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
      <div className="text-4xl">🎈</div>
      <h1 className="mt-4 font-display text-2xl text-ink">
        There&apos;s nothing at this link
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink/60">
        It might be mistyped, or the page may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream"
      >
        Go to nimDay
      </Link>
    </main>
  );
}
