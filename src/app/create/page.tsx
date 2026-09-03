import type { Metadata } from "next";
import Link from "next/link";
import { CreateWizard } from "@/components/create/CreateWizard";

export const metadata: Metadata = {
  title: "Create your NIMday",
  robots: { index: false },
};

export default function CreatePage() {
  return (
    <main className="min-h-dvh bg-cream px-5 py-10">
      <div className="mx-auto mb-8 max-w-xl">
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">
          ← NIMday
        </Link>
        <h1 className="mt-2 font-display text-3xl text-ink">Create your NIMday</h1>
        <p className="mt-1 text-sm text-ink/60">
          A birthday card and a small wishlist, in one link. Takes about a minute.
        </p>
      </div>
      <CreateWizard />
    </main>
  );
}
