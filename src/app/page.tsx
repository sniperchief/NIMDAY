import type { Metadata } from "next";
import Link from "next/link";
import { BirthdayCard } from "@/components/BirthdayCard";
import { WishList } from "@/components/WishList";
import { GiftMark, Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = {
  title: { absolute: "nimDay — Your birthday. Your wishes. One beautiful link." },
};

const SAMPLE = {
  name: "Sarah",
  birthday: sampleBirthdayISO(),
  message: null,
  theme: "confetti",
  // Pexels photo, cropped to a 384px square and compressed (~20 KB). The
  // original stays out of the repo.
  imageUrl: "/sample/sarah.jpg",
};

const SAMPLE_WISHES = [
  {
    id: "s1",
    title: "New headphones",
    description: "The over-ear ones I keep talking about",
    imageUrl: "/sample/headphones.jpg",
    targetNim: "120",
    currency: "NIM" as const,
    giftType: "FUND" as const,
    raisedNim: "85",
    progressPct: 71,
    fulfilled: false,
  },
  {
    id: "s2",
    title: "iPhone 18",
    description: null,
    imageUrl: "/sample/iphone-18.jpg",
    targetNim: "60",
    currency: "NIM" as const,
    giftType: "EITHER" as const,
    raisedNim: "60",
    progressPct: 100,
    fulfilled: true,
  },
];

/**
 * A birthday about a month away (and a plausible birth year), so the sample's
 * date tile always shows an upcoming date whenever the page was built.
 */
function sampleBirthdayISO() {
  const next = new Date();
  next.setUTCMonth(next.getUTCMonth() + 1);
  const born = new Date(
    Date.UTC(next.getUTCFullYear() - 30, next.getUTCMonth(), next.getUTCDate()),
  );
  return born.toISOString().slice(0, 10);
}

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-white">
      <header className="mx-auto flex max-w-6xl items-center px-5 pt-6">
        <Link
          href="/"
          aria-label="nimDay home"
          className="-ml-1 inline-flex min-h-[44px] items-center rounded-lg px-1 text-ink"
        >
          <Wordmark className="h-7 w-auto" />
        </Link>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:pb-24 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-16">
          {/* ---------- words ---------- */}
          <section className="animate-fade-up text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-ink/70 ring-1 ring-black/[0.08]">
              <GiftMark className="h-3.5 w-3.5" />
              A birthday card that gives back
            </span>

            <h1 className="mt-5 font-display text-[40px] leading-[1.05] text-ink sm:text-6xl">
              Your birthday.
              <br />
              Your wishes.
              <br />
              <span className="text-persimmon">One beautiful link.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ink/65 lg:mx-0">
              Make a card, add a few things you&apos;d actually love, and share one
              link. Friends pick a wish and send a gift straight to your wallet.
            </p>

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:justify-start">
              <Link
                href="/create"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-ink px-7 text-base font-semibold text-cream shadow-[0_18px_36px_-12px_rgba(36,31,26,0.55),0_6px_12px_-6px_rgba(36,31,26,0.35)] transition hover:bg-ink/90 hover:shadow-[0_22px_44px_-12px_rgba(36,31,26,0.6),0_8px_16px_-6px_rgba(36,31,26,0.4)] active:scale-[0.98]"
              >
                Create your nimDay
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-7 text-base font-medium text-ink ring-1 ring-black/[0.1] transition hover:bg-black/[0.02] active:scale-[0.98]"
              >
                My nimDay
              </Link>
            </div>
          </section>

          {/* ---------- the card ---------- */}
          <section className="relative mx-auto w-full max-w-[380px] lg:max-w-none">
            {/* stacked card behind, for depth */}
            <div
              aria-hidden
              className="absolute inset-x-4 top-6 h-full animate-float-slow rounded-[28px] bg-white shadow-[0_30px_60px_-20px_rgba(36,31,26,0.35)] ring-1 ring-black/[0.05]"
            />
            {/* the card brings its own shadow; the float is homepage-only */}
            <div className="relative animate-float">
              <BirthdayCard data={SAMPLE} compact>
                <WishList wishes={SAMPLE_WISHES} theme={SAMPLE.theme} />
              </BirthdayCard>
            </div>
          </section>
        </div>
      </div>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 pb-10 text-xs text-ink/40 sm:flex-row sm:justify-between">
        <Wordmark className="h-4 w-auto text-ink/50" />
        <span>A birthday product powered by NIM.</span>
      </footer>
    </main>
  );
}
