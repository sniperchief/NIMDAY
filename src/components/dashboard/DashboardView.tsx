"use client";

import Link from "next/link";
import { Button, Card, cn } from "@/components/ui";
import { ShareSection } from "@/components/ShareControls";
import { Countdown } from "@/components/Countdown";
import { getTheme } from "@/lib/themes";
import { activityEmoji, activityLine, timeAgo } from "@/lib/activityText";
import { MessagesCard } from "@/components/dashboard/MessagesCard";
import type { CreatorDashboard } from "@/lib/apiClient";

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "🎂"
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.035] px-3 py-3 text-center ring-1 ring-black/[0.05]">
      <p className="font-display text-2xl leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-ink/45">{label}</p>
    </div>
  );
}

/**
 * "My nimDay" — the creator's own page. Every number here comes from the same
 * verified gift ledger the public page reads; nothing on this screen is a
 * second source of truth for money.
 */
export function DashboardView({ data }: { data: CreatorDashboard }) {
  const { overview, summary, activity, messages } = data;
  const theme = getTheme(overview.theme);

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      {/* ---------- overview ---------- */}
      {/* Not <Card>: this one needs edge-to-edge sections, and overriding Card's
          padding with p-0 is not a fight Tailwind reliably lets you win. */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_40px_-24px_rgba(0,0,0,0.25)] ring-1 ring-black/5">
        <div className={cn("px-5 pb-5 pt-5 sm:px-6", theme.card)}>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex-none overflow-hidden rounded-full bg-white ring-2 ring-white">
              {overview.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={overview.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center text-lg font-semibold text-white",
                    theme.accent,
                  )}
                >
                  {initials(overview.name)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.14em] text-ink/45">
                My nimDay
              </p>
              <h1 className="truncate font-display text-2xl text-ink">
                {overview.name}
              </h1>
              <p className="text-sm text-ink/55">
                {new Date(`${overview.birthday}T00:00:00.000Z`).toLocaleDateString(
                  undefined,
                  { day: "numeric", month: "long", timeZone: "UTC" },
                )}
              </p>
            </div>
            {/* Published is a brand moment; Draft is neutral, so it is never
                mistaken for a warning. White on deep persimmon reads at 5.12:1. */}
            <span
              className={cn(
                "flex-none self-start rounded-full px-2.5 py-1 text-xs font-medium",
                overview.published
                  ? "bg-persimmon-deep text-white"
                  : "bg-black/[0.05] text-ink/70",
              )}
            >
              {overview.published ? "Published" : "Draft"}
            </span>
          </div>

          {overview.testnet ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
              <span className="font-semibold">Test network.</span> This nimDay is
              running on Nimiq testnet — any gift shown below is test NIM and has
              no value.
            </p>
          ) : null}

          <div className="mt-4 flex justify-center">
            <Countdown
              name={overview.name}
              birthdayISO={overview.birthday}
              className={cn(theme.accent, theme.accentText)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-black/5 px-5 py-4 sm:px-6">
          <Link href="/create" className="flex-1 sm:flex-none">
            <Button variant="secondary" className="w-full">
              Edit
            </Button>
          </Link>
          {overview.published ? (
            <a
              href={overview.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none"
            >
              <Button variant="secondary" className="w-full">
                Preview
              </Button>
            </a>
          ) : null}
        </div>
      </section>

      {/* ---------- share ---------- */}
      {overview.published ? (
        <ShareSection url={overview.url} name={overview.name} audience="creator" />
      ) : (
        <Card>
          <h2 className="font-display text-xl text-ink">Not shared yet</h2>
          <p className="mt-1 text-sm text-ink/60">
            Publish your nimDay to get your link — that&apos;s the part you send to
            friends.
          </p>
          <Link href="/create" className="mt-4 inline-block">
            <Button>Finish and publish</Button>
          </Link>
        </Card>
      )}

      {/* ---------- gift summary ---------- */}
      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Gifts</h2>
          <p className="text-xs text-ink/45">verified on the Nimiq network</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value={String(summary.giftCount)} label="gifts" />
          <Stat value={summary.totalNim} label="NIM total" />
          <Stat
            value={`${summary.wishesFulfilled}/${summary.wishCount}`}
            label="wishes filled"
          />
          <Stat value={String(summary.messageCount)} label="messages" />
        </div>

        {summary.wishes.length > 0 ? (
          <ul className="mt-5 space-y-3.5">
            {summary.wishes.map((w) => (
              <li key={w.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium text-ink">
                    {w.title}
                  </p>
                  <p className="flex-none text-xs text-ink/55">
                    {w.fulfilled ? (
                      <span className="font-semibold text-persimmon-deep">
                        🎉 fulfilled
                      </span>
                    ) : (
                      <>
                        {w.raisedNim} / {w.targetNim} NIM
                      </>
                    )}
                  </p>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/[0.07]">
                  <div
                    className={cn("h-full rounded-full", theme.accent)}
                    style={{
                      width: `${w.progressPct === 0 ? 0 : Math.max(6, w.progressPct)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-ink/50">
            No wishes yet.{" "}
            <Link href="/create" className="underline">
              Add one
            </Link>{" "}
            so friends know what you&apos;d love.
          </p>
        )}
      </Card>

      {/* ---------- messages ---------- */}
      <MessagesCard messages={messages} />

      {/* ---------- activity ---------- */}
      <Card>
        <h2 className="font-display text-xl text-ink">Activity</h2>
        {activity.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-black/10 p-5 text-center">
            <p className="text-2xl">🎈</p>
            <p className="mt-2 text-sm text-ink/55">
              Nothing yet. Share your link and your first gifts and messages
              will land here.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-black/[0.06]">
            {activity.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                <span className="flex-none text-lg" aria-hidden>
                  {activityEmoji(item.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{activityLine(item)}</p>
                  {item.excerpt ? (
                    <p className="mt-0.5 truncate text-xs italic text-ink/50">
                      “{item.excerpt}”
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-ink/40">{timeAgo(item.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
