import Link from "next/link";
import { BirthdayCard } from "@/components/BirthdayCard";
import { WishList } from "@/components/WishList";

const SAMPLE = {
  name: "Sarah",
  birthday: nextMonthISO(),
  message: "Turning a year wiser — thank you for celebrating with me! ❤️",
  theme: "confetti",
  imageUrl: null,
};

const SAMPLE_WISHES = [
  {
    id: "s1",
    title: "New headphones",
    description: "The over-ear ones I keep talking about",
    imageUrl: null,
    targetNim: "120",
    currency: "NIM" as const,
    giftType: "FUND" as const,
    raisedNim: "85",
    progressPct: 71,
    fulfilled: false,
  },
  {
    id: "s2",
    title: "Pottery class",
    description: null,
    imageUrl: null,
    targetNim: "60",
    currency: "NIM" as const,
    giftType: "EITHER" as const,
    raisedNim: "60",
    progressPct: 100,
    fulfilled: true,
  },
];

function nextMonthISO() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** Soft colour wash behind the card. Decorative only. */
function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ff5c8a]/20 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute top-40 -right-20 h-64 w-64 rounded-full bg-[#ffd166]/25 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[#4cc9f0]/20 blur-3xl" />
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Glow />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-6">
        <span className="font-display text-lg text-ink">NIMday</span>
        <Link
          href="/dashboard"
          className="rounded-full px-4 py-2 text-sm font-medium text-ink/60 transition hover:bg-black/[0.04] hover:text-ink"
        >
          My NIMday
        </Link>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:pb-24 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-16">
          {/* ---------- words ---------- */}
          <section className="animate-fade-up text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-medium text-ink/70 ring-1 ring-black/[0.06] backdrop-blur">
              🎂 A birthday card that gives back
            </span>

            <h1 className="mt-5 font-display text-[40px] leading-[1.05] text-ink sm:text-6xl">
              Your birthday.
              <br />
              Your wishes.
              <br />
              <span className="text-[#ff5c8a]">One beautiful link.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ink/65 lg:mx-0">
              Make a card, add a few things you&apos;d actually love, and share one
              link. Friends pick a wish and send a gift straight to your wallet.
            </p>

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:justify-start">
              <Link
                href="/create"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-ink px-7 text-base font-semibold text-cream shadow-lg shadow-black/10 transition active:scale-[0.98]"
              >
                Create your NIMday
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white/80 px-7 text-base font-medium text-ink ring-1 ring-black/[0.08] backdrop-blur transition active:scale-[0.98]"
              >
                My NIMday
              </Link>
            </div>

            <p className="mt-5 text-sm text-ink/45">
              Takes about a minute · NIMday never holds your money
            </p>
          </section>

          {/* ---------- the card ---------- */}
          <section className="relative mx-auto w-full max-w-[380px] lg:max-w-none">
            {/* stacked card behind, for depth */}
            <div
              aria-hidden
              className="absolute inset-x-4 top-6 h-full animate-float-slow rounded-[28px] bg-white/60 shadow-xl ring-1 ring-black/[0.04]"
            />
            <div className="relative animate-float">
              <BirthdayCard data={SAMPLE} compact>
                <WishList wishes={SAMPLE_WISHES} theme={SAMPLE.theme} />
              </BirthdayCard>
            </div>
          </section>
        </div>
      </div>

      <footer className="mx-auto max-w-6xl px-5 pb-10 text-center text-xs text-ink/40 lg:text-left">
        NIMday — a birthday product powered by NIM.
      </footer>
    </main>
  );
}
