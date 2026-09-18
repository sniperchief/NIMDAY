import * as React from "react";
import Link from "next/link";
import { BirthdayCard } from "@/components/BirthdayCard";
import { WishList } from "@/components/WishList";
import { MessageNote } from "@/components/public/MessageBoard";
import { getTheme } from "@/lib/themes";
import { MAX_WISHES } from "@/lib/validation";
import {
  SAMPLE,
  SAMPLE_GIFT_AFTER,
  SAMPLE_GIFT_BEFORE,
  SAMPLE_MESSAGES,
  SAMPLE_WISHLIST,
  SAMPLE_SHOWCASE,
  SAMPLE_SHOWCASE_MESSAGES,
  SAMPLE_SHOWCASE_WISHES,
} from "@/components/landing/sample";

/*
 * The homepage sections below the hero. Every demo here renders the same
 * components a real nimDay uses, fed with the static sample data in
 * ./sample.ts — nothing is fetched and no wallet is needed.
 */

const theme = getTheme(SAMPLE.theme);

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className = "",
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-6 py-16 sm:py-20 ${className}`}
    >
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-persimmon-deep">
            {eyebrow}
          </p>
          <h2
            id={`${id}-title`}
            className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl"
          >
            {title}
          </h2>
          {intro ? (
            <p className="mt-3 text-base leading-relaxed text-ink/65">{intro}</p>
          ) : null}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/** A surface that looks like the card, for demos shown outside a BirthdayCard. */
function DemoSurface({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[28px] p-5 ring-1 ring-black/[0.06] shadow-[0_24px_48px_-24px_rgba(36,31,26,0.3)] sm:p-6 ${theme.card} ${theme.text}`}
    >
      {label ? (
        <p className={`mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] ${theme.muted}`}>
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function CheckList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink/75">
          <span
            aria-hidden
            className="mt-[3px] flex h-5 w-5 flex-none items-center justify-center rounded-full bg-persimmon-soft text-[11px] font-bold text-persimmon-deep"
          >
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

export function HowItWorks() {
  const steps = [
    {
      title: "Create your nimDay",
      body: `Add your name, birthday and a photo, pick a card style, and list up to ${MAX_WISHES} things you'd love. Connect your Nimiq wallet in Nimiq Pay to publish.`,
    },
    {
      title: "Share your link",
      body: "Your nimDay gets its own link. Copy it or send it straight from your phone to friends and family.",
    },
    {
      title: "Receive gifts",
      body: "Friends choose a wish and send NIM directly to your wallet. Each gift is verified on the Nimiq network before it counts.",
    },
  ];

  return (
    <Section
      id="how-it-works"
      eyebrow="How nimDay works"
      title="Three steps to a birthday worth sharing"
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.08]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-cream">
              {i + 1}
            </span>
            <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink/65">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function WishlistExperience() {
  return (
    <Section
      id="wishlist"
      eyebrow="Your wishlist"
      title="Ask for the things you actually want"
      intro="No more guessing and no more duplicate gifts. Your nimDay is a short list of real wishes, and friends can see exactly how close each one is."
    >
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <CheckList
          items={[
            <>
              <strong className="font-semibold text-ink">Add up to {MAX_WISHES} wishes</strong>{" "}
              — anything from new AirPods to a new phone.
            </>,
            <>
              <strong className="font-semibold text-ink">Give each wish a title and a NIM target</strong>
              , plus an optional description and photo.
            </>,
            <>
              <strong className="font-semibold text-ink">Share one link</strong> — your
              whole wishlist lives on your nimDay page.
            </>,
            <>
              <strong className="font-semibold text-ink">Track progress</strong> — every
              verified gift moves the bar, and your dashboard shows each wish&apos;s progress and recent gifts.
            </>,
            <>
              <strong className="font-semibold text-ink">See when it&apos;s fulfilled</strong>{" "}
              — once a wish reaches its target, it&apos;s marked Fulfilled.
            </>,
          ]}
        />

        <DemoSurface>
          <WishList
            wishes={SAMPLE_WISHLIST}
            theme={SAMPLE.theme}
            heading={
              <div className="mb-3">
                <h3 className={`text-base font-semibold ${theme.text}`}>
                  Things {SAMPLE.name} would love
                </h3>
                <p className={`mt-0.5 text-[13px] ${theme.muted}`}>
                  Just added · in progress · fulfilled
                </p>
              </div>
            }
          />
        </DemoSurface>
      </div>
    </Section>
  );
}

export function ProductShowcase() {
  return (
    <Section
      id="showcase"
      eyebrow="See a nimDay"
      title="This is what your friends will see"
      intro="A birthday card first, a wishlist second, and a place for everyone's messages. Below is an example nimDay, built with the same card your guests get."
      className="bg-cream"
    >
      <div className="mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-12">
        <BirthdayCard data={SAMPLE_SHOWCASE} compact>
          <WishList
            wishes={SAMPLE_SHOWCASE_WISHES}
            theme={SAMPLE.theme}
            heading={
              <div className="mb-3">
                <h3 className={`text-base font-semibold ${theme.text}`}>
                  Things {SAMPLE_SHOWCASE.name} would love
                </h3>
                <p className={`mt-0.5 text-[13px] ${theme.muted}`}>
                  On a real nimDay, friends tap a wish to send a gift.
                </p>
              </div>
            }
          />
        </BirthdayCard>

        <div className="space-y-4">
          <DemoSurface label="Messages">
            <ul className="grid gap-3">
              {SAMPLE_SHOWCASE_MESSAGES.map((m, i) => (
                <MessageNote key={m.id} message={m} theme={theme} index={i} />
              ))}
            </ul>
          </DemoSurface>
          <p className="px-1 text-xs text-ink/45">
            Example nimDay with sample content. Real nimDays live at their own link.
          </p>
        </div>
      </div>
    </Section>
  );
}

export function NimGifting() {
  const flow = [
    { title: "A friend chooses a wish", body: "and picks how much NIM to give — any amount helps." },
    { title: "They connect their Nimiq wallet", body: "in Nimiq Pay. On a computer, nimDay shows a QR code to continue on their phone." },
    { title: "They send NIM", body: "directly from their wallet to yours, approved in Nimiq Pay." },
    { title: "nimDay verifies the transaction", body: "on the Nimiq network — right recipient, right amount, confirmed on-chain." },
    { title: "The wish's progress updates", body: "on your nimDay and in your dashboard." },
  ];

  return (
    <Section
      id="gifting"
      eyebrow="NIM gifting"
      title="Gifts go straight to your wallet"
    >
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <ol className="relative grid gap-5">
            {flow.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-persimmon-soft text-sm font-semibold text-persimmon-deep">
                  {i + 1}
                </span>
                <p className="pt-1 text-[15px] leading-relaxed text-ink/65">
                  <span className="font-semibold text-ink">{s.title}</span> {s.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-3xl bg-cream p-5 ring-1 ring-black/[0.06]">
            <p className="text-sm font-semibold text-ink">nimDay never holds your gifts</p>
            <p className="mt-1 text-sm leading-relaxed text-ink/65">
              Every gift is a payment from your friend&apos;s wallet to yours. nimDay
              doesn&apos;t custody funds and never asks for keys or seed phrases —
              it only checks the Nimiq network to confirm a gift arrived, and a
              payment only counts once that check passes.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <DemoSurface label="Before the gift">
            <WishList wishes={[SAMPLE_GIFT_BEFORE]} theme={SAMPLE.theme} />
          </DemoSurface>
          <p aria-hidden className="text-center text-sm font-medium text-ink/45">
            ↓ Maya sends 35 NIM · verified on-chain
          </p>
          <DemoSurface label="After verification">
            <WishList wishes={[SAMPLE_GIFT_AFTER]} theme={SAMPLE.theme} />
          </DemoSurface>
        </div>
      </div>
    </Section>
  );
}

export function BirthdayMessages() {
  const m = SAMPLE_MESSAGES;

  return (
    <Section
      id="messages"
      eyebrow="Birthday messages"
      title="Words matter as much as gifts"
      intro="Anyone with the link can leave a birthday message — no wallet needed. Messages appear on the nimDay for everyone to enjoy."
      className="bg-cream"
    >
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <CheckList
          items={[
            <>
              <strong className="font-semibold text-ink">Signed with a name</strong> — friends
              can add their name to the message.
            </>,
            <>
              <strong className="font-semibold text-ink">From &ldquo;A friend&rdquo;</strong> —
              leave the name blank and the message is signed &ldquo;A friend&rdquo;.
            </>,
            <>
              <strong className="font-semibold text-ink">Anonymous</strong> — the name stays
              hidden inside nimDay and the message shows as &ldquo;Someone&rdquo;.
            </>,
            <>
              <strong className="font-semibold text-ink">With a gift</strong> — a message
              written after a confirmed gift shows the amount and the wish it went to.
            </>,
          ]}
        />

        <DemoSurface>
          <ul className="grid gap-3">
            {[m.gift, m.named, m.friend, m.anonymous].map((msg, i) => (
              <MessageNote key={msg.id} message={msg} theme={theme} index={i} />
            ))}
          </ul>
        </DemoSurface>
      </div>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="rounded-[32px] bg-ink px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2
            id="final-cta-title"
            className="mx-auto max-w-xl font-display text-3xl leading-tight text-cream sm:text-5xl"
          >
            Make this birthday the one you actually wanted.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-cream/70">
            A card, a few wishes and one link. It takes about a minute, and gifts
            arrive straight in your wallet.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/create"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-cream px-7 text-base font-semibold text-ink transition hover:bg-white active:scale-[0.98]"
            >
              Create your nimDay
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full px-7 text-base font-medium text-cream ring-1 ring-cream/30 transition hover:bg-cream/10 active:scale-[0.98]"
            >
              Already have one? Open My nimDay
            </Link>
          </div>
          <p className="mt-4 text-xs text-cream/50">
            Sign in with the Nimiq wallet you created it with.
          </p>
        </div>
      </div>
    </section>
  );
}
