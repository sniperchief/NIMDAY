import type { Metadata } from "next";
import Link from "next/link";
import { CreateWizard } from "@/components/create/CreateWizard";
import { Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = {
  title: "Create your nimDay",
  robots: { index: false },
};

export default function CreatePage() {
  return (
    <main className="min-h-dvh bg-white px-4 py-6 sm:px-5 sm:py-10">
      <div className="mx-auto mb-6 max-w-xl sm:mb-8">
        <Link
          href="/"
          aria-label="nimDay home"
          className="-ml-1 inline-flex min-h-[44px] items-center rounded-lg px-1 text-ink"
        >
          <Wordmark className="h-6 w-auto" />
        </Link>
        <h1 className="mt-4 font-display text-3xl text-ink sm:text-4xl">
          Create your nimDay
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          A birthday card and a small wishlist, in one link.
        </p>
      </div>
      <CreateWizard />
    </main>
  );
}
