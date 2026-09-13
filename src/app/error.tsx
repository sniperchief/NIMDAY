"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The last line of defence for an unexpected render or data error.
 *
 * The visitor gets a sentence they can act on and nothing else: no stack, no
 * error code, no database message. The real detail goes to the server log,
 * where it belongs. (`digest` is Next's own server-side correlation id — safe
 * to show, and the only thing worth quoting if someone reports a problem.)
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[nimday] unhandled error", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
      <div className="text-4xl">🎈</div>
      <h1 className="mt-4 font-display text-2xl text-ink">
        Something went wrong at our end
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink/60">
        Nothing you did caused this, and no gift or message was affected. Try
        again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-ink ring-1 ring-black/10"
        >
          Back to nimDay
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-[11px] text-ink/30">
          reference {error.digest}
        </p>
      ) : null}
    </main>
  );
}
