import Link from "next/link";
import { BirthdayCard } from "@/components/BirthdayCard";

const SAMPLE = {
  name: "Sarah",
  birthday: nextMonthISO(),
  message: "Turning a year wiser — thank you for celebrating with me! ❤️",
  theme: "confetti",
  imageUrl: null,
  wishes: [
    {
      id: "s1",
      title: "New headphones",
      description: "The over-ear ones I keep talking about",
      imageUrl: null,
      targetNim: "120",
      currency: "NIM" as const,
      giftType: "FUND" as const,
    },
    {
      id: "s2",
      title: "Pottery class",
      description: null,
      imageUrl: null,
      targetNim: "60",
      currency: "NIM" as const,
      giftType: "EITHER" as const,
    },
  ],
};

function nextMonthISO() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

const STEPS = [
  ["Create", "Add the birthday, a message, and a few wishes. Pick a theme."],
  ["Connect", "Link your Nimiq Pay wallet so gifts can reach you directly."],
  ["Share", "Send one beautiful link to the people who want to celebrate you."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
      <section className="grid items-center gap-12 lg:grid-cols-2">
        <div className="animate-fade-up">
          <p className="text-sm font-medium uppercase tracking-wide text-ink/45">
            NIMday
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink sm:text-5xl">
            Your birthday. Your wishes. One beautiful link.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink/65">
            A digital birthday card that doubles as a gift wishlist. Friends open
            it, pick something you&apos;d love, and send a NIM gift straight to
            your wallet — no middleman, no awkward asking.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/create"
              className="rounded-full bg-ink px-6 py-3.5 text-base font-medium text-cream transition active:scale-[0.98]"
            >
              Create your NIMday
            </Link>
            <a
              href="#how"
              className="rounded-full bg-white px-6 py-3.5 text-base font-medium text-ink ring-1 ring-black/10"
            >
              How it works
            </a>
          </div>
          <p className="mt-4 text-xs text-ink/40">
            Takes about a minute. NIMday never holds your money.
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm animate-pop-in">
          <BirthdayCard data={SAMPLE} />
        </div>
      </section>

      <section id="how" className="mt-24 scroll-mt-10">
        <h2 className="font-display text-2xl text-ink">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li
              key={title}
              className="rounded-2xl bg-white p-5 ring-1 ring-black/5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-cream">
                {i + 1}
              </span>
              <h3 className="mt-3 font-medium text-ink">{title}</h3>
              <p className="mt-1 text-sm text-ink/60">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-24 border-t border-black/10 pt-6 text-xs text-ink/40">
        NIMday — a birthday product powered by NIM.
      </footer>
    </main>
  );
}
