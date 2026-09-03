import * as React from "react";
import { getTheme } from "@/lib/themes";
import { GIFT_TYPE_LABEL } from "@/lib/amount";
import { cn } from "@/components/ui";
import { ThemeMotif } from "@/components/ThemeMotif";
import { Countdown } from "@/components/Countdown";

export interface BirthdayCardWish {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  currency: "NIM" | "USDT";
  giftType: "FUND" | "BUY" | "EITHER";
  /** trimmed NIM string, e.g. "120" */
  targetNim: string;
  /** present on the public page (verified contributions only) */
  raisedNim?: string;
  progressPct?: number;
  fulfilled?: boolean;
}

export interface BirthdayCardData {
  name: string;
  birthday: string;
  message: string | null;
  theme: string;
  imageUrl: string | null;
  wishes: BirthdayCardWish[];
}

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

function WishRow({
  wish,
  theme,
  onGift,
}: {
  wish: BirthdayCardWish;
  theme: ReturnType<typeof getTheme>;
  onGift?: (wishId: string) => void;
}) {
  const showProgress = wish.raisedNim !== undefined;
  const inner = (
    <>
      <div className="h-16 w-16 flex-none overflow-hidden rounded-xl bg-black/5">
        {wish.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={wish.imageUrl}
            alt={wish.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl opacity-40">
            🎁
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold">{wish.title}</p>
        {wish.description ? (
          <p className={cn("mt-0.5 line-clamp-2 text-xs", theme.muted)}>
            {wish.description}
          </p>
        ) : null}

        {showProgress ? (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className={cn("h-full rounded-full", theme.accent)}
                style={{ width: `${Math.max(2, wish.progressPct ?? 0)}%` }}
              />
            </div>
            <p className={cn("mt-1 text-xs", theme.muted)}>
              {wish.fulfilled ? (
                <span className="font-medium">🎉 Wish fulfilled!</span>
              ) : (
                <>
                  {wish.raisedNim} / {wish.targetNim} NIM
                </>
              )}
              <span className="mx-1.5">·</span>
              {GIFT_TYPE_LABEL[wish.giftType]}
            </p>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                theme.accent,
                theme.accentText,
              )}
            >
              {wish.targetNim} {wish.currency}
            </span>
            <span className={cn("text-xs", theme.muted)}>
              {GIFT_TYPE_LABEL[wish.giftType]}
            </span>
          </div>
        )}
      </div>
      {onGift ? (
        <span
          className={cn(
            "self-center rounded-full px-3 py-1.5 text-xs font-medium",
            theme.accent,
            theme.accentText,
          )}
        >
          Gift
        </span>
      ) : null}
    </>
  );

  const base =
    "flex w-full gap-3 rounded-2xl bg-black/[0.03] p-3 ring-1 ring-black/5";

  return onGift ? (
    <button
      type="button"
      onClick={() => onGift(wish.id)}
      className={cn(base, "text-left transition hover:bg-black/[0.06] active:scale-[0.99]")}
    >
      {inner}
    </button>
  ) : (
    <div className={base}>{inner}</div>
  );
}

export function BirthdayCard({
  data,
  action,
  onWishGift,
  className,
}: {
  data: BirthdayCardData;
  /** slot rendered under the wishes — the share row / footer */
  action?: React.ReactNode;
  /** when provided, each wish becomes a button that starts the gift flow */
  onWishGift?: (wishId: string) => void;
  className?: string;
}) {
  const theme = getTheme(data.theme);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[28px] ring-1 ring-black/5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]",
        theme.card,
        theme.text,
        className,
      )}
    >
      <div className="relative h-28">
        <ThemeMotif theme={theme} />
      </div>

      <div className="px-6 pb-8 -mt-14 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-white ring-4 ring-white shadow-md">
            {data.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageUrl}
                alt={data.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center text-2xl font-semibold text-white",
                  theme.accent,
                )}
              >
                {initials(data.name)}
              </div>
            )}
          </div>

          <p className={cn("mt-4 text-sm", theme.muted)}>It&apos;s a birthday</p>
          <h1
            className={cn(
              "mt-1 text-3xl font-semibold leading-tight sm:text-4xl",
              theme.heading,
            )}
          >
            {data.name || "Someone special"}
          </h1>

          <Countdown
            name={data.name || "the"}
            birthdayISO={data.birthday}
            className={cn("mt-3", theme.accent, theme.accentText)}
          />

          {data.message ? (
            <p
              className={cn(
                "mt-5 max-w-md whitespace-pre-line text-[15px] leading-relaxed",
                theme.text,
              )}
            >
              {data.message}
            </p>
          ) : null}
        </div>

        {data.wishes.length > 0 && (
          <section className="mt-8">
            <h2 className={cn("mb-3 text-sm font-semibold", theme.muted)}>
              {data.wishes.length === 1
                ? "One wish"
                : `${data.wishes.length} wishes`}
              {onWishGift ? (
                <span className="ml-1 font-normal">· tap one to send a gift</span>
              ) : null}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.wishes.map((w) => (
                <li key={w.id}>
                  <WishRow wish={w} theme={theme} onGift={onWishGift} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    </article>
  );
}
