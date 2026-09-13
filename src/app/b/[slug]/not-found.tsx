import Link from "next/link";

export default function BirthdayNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
      <div className="text-4xl">🎈</div>
      <h1 className="mt-4 font-display text-2xl text-ink">
        This nimDay isn&apos;t here
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink/60">
        The link might be mistyped, or this nimDay hasn&apos;t been published yet.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream"
      >
        Make your own nimDay
      </Link>
    </main>
  );
}
