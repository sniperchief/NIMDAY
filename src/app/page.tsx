import type { Metadata } from "next";
import Link from "next/link";
import { GiftMark, Wordmark } from "@/components/brand/Wordmark";
import { WishList } from "@/components/WishList";
import { SAMPLE, SAMPLE_HERO_WISH } from "@/components/landing/sample";
import {
  BirthdayMessages,
  FinalCta,
  HowItWorks,
  NimGifting,
  ProductShowcase,
  WishlistExperience,
} from "@/components/landing/LandingSections";

export const metadata: Metadata = {
  title: { absolute: "nimDay — Your birthday. Your wishes. One beautiful link." },
};

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-white">
      {/* ---------- hero ---------- */}
      {/* The photo is the hero's background. On desktop it fills the right
          side and fades into white behind the words. On smaller screens it
          runs edge to edge across the top and fades down into white, and the
          words start just below it, so text is never read over the photo. */}
      <div className="relative">
        <header className="relative z-10 mx-auto flex max-w-6xl items-center px-5 pt-6">
          <Link
            href="/"
            aria-label="nimDay home"
            className="-ml-1 inline-flex min-h-[44px] items-center rounded-lg px-1 text-ink"
          >
            <Wordmark className="h-7 w-auto" />
          </Link>
        </header>

        {/* Mobile top padding = photo height − header (68px) − 32px, so the
            badge sits on the last, white part of the fade. */}
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-[calc(min(100vw,440px)_-_100px)] sm:pb-24 lg:pb-32 lg:pt-24">
          <div className="absolute inset-x-0 top-0 h-[min(100vw,440px)] overflow-hidden lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[62%] xl:w-[66%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero/opening-gift-1280.jpg"
              srcSet="/hero/opening-gift-800.jpg 800w, /hero/opening-gift-1280.jpg 1280w, /hero/opening-gift-2048.jpg 2048w"
              sizes="(min-width: 1024px) 66vw, 100vw"
              alt=""
              width={2048}
              height={1365}
              fetchPriority="high"
              className="h-full w-full object-cover object-[58%_40%] lg:object-[65%_30%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-transparent from-60% to-white lg:hidden"
            />
            <div
              aria-hidden
              className="absolute inset-0 hidden bg-gradient-to-r from-white via-white/80 via-25% to-transparent to-60% lg:block"
            />
            {/* The product in the moment: the wish his friends just paid for,
                level with his face and just past his cheek. Desktop only —
                on a phone it would cover him. */}
            <div
              aria-hidden
              className="absolute left-[64%] top-[190px] hidden w-[220px] rounded-[20px] bg-white p-1.5 shadow-[0_24px_48px_-16px_rgba(36,31,26,0.45)] ring-1 ring-black/[0.06] lg:block xl:w-[280px]"
            >
              <WishList wishes={[SAMPLE_HERO_WISH]} theme={SAMPLE.theme} />
            </div>
          </div>

          <section className="relative z-10 animate-fade-up text-center lg:max-w-xl lg:text-left">
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
              Create a beautiful birthday card, add the things you actually want,
              and share one link. Friends can pick a wish and send NIM straight to
              your wallet.
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
        </div>
      </div>

      <HowItWorks />
      <WishlistExperience />
      <ProductShowcase />
      <NimGifting />
      <BirthdayMessages />
      <FinalCta />

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 pb-10 text-xs text-ink/40 sm:flex-row sm:justify-between">
        <Wordmark className="h-4 w-auto text-ink/50" />
        <span>A birthday product powered by NIM.</span>
      </footer>
    </main>
  );
}
