import type { Metadata } from "next";
import Link from "next/link";
import { CreateWizard } from "@/components/create/CreateWizard";

export const metadata: Metadata = {
  title: "Create your NIMday",
  robots: { index: false },
};

export default function CreatePage() {
  return (
    <main className="min-h-dvh bg-cream px-4 py-6 sm:px-5 sm:py-10">
      <div className="mx-auto mb-6 max-w-xl sm:mb-8">
        <Link
          href="/"
          className="-ml-2 inline-flex min-h-[40px] items-center rounded-full px-2 text-sm text-ink/50 transition hover:text-ink"
        >
          ← NIMday
        </Link>
        <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">
          Create your NIMday
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          A birthday card and a small wishlist, in one link.
        </p>
      </div>
      <CreateWizard />
    </main>
  );
}
