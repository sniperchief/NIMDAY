import * as React from "react";
import { getTheme } from "@/lib/themes";
import { GIFT_TYPE_LABEL } from "@/lib/amount";
import { cn } from "@/components/ui";

export interface WishCardData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  currency: "NIM" | "USDT";
  giftType: "FUND" | "BUY" | "EITHER";
  /** trimmed NIM string, e.g. "120" */
  targetNim: string;
  /** present on the public page only (verified contributions) */
  raisedNim?: string;
  progressPct?: number;
  fulfilled?: boolean;
}

function Thumb({ wish }: { wish: WishCardData }) {
  return (
    <div className="h-[68px] w-[68px] flex-none overflow-hidden rounded-2xl bg-black/[0.06] sm:h-20 sm:w-20">
      {wish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={wish.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl opacity-35">
          🎁
        </div>
      )}
    </div>
  );
}

function Progress({
  wish,
  theme,
}: {
  wish: WishCardData;
  theme: ReturnType<typeof getTheme>;
}) {
  const pct = Math.max(0, Math.min(100, wish.progressPct ?? 0));
  return (
    <div className="mt-2.5">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-black/[0.08]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${wish.title} progress`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            theme.accent,
          )}
          style={{ width: `${pct === 0 ? 0 : Math.max(6, pct)}%` }}
        />
      </div>
      <p className={cn("mt-1.5 text-[13px]", theme.muted)}>
        {wish.fulfilled ? (
          <span className="font-semibold">🎉 Wish fulfilled!</span>
        ) : (
          <>
            <span className="font-semibold">{wish.raisedNim}</span> of{" "}
            {wish.targetNim} NIM
          </>
        )}
      </p>
    </div>
  );
}

function WishCard({
  wish,
  theme,
  onGift,
}: {
  wish: WishCardData;
  theme: ReturnType<typeof getTheme>;
  onGift?: (wishId: string) => void;
}) {
  const showProgress = wish.raisedNim !== undefined;

  const body = (
    <>
      <div className="flex gap-3.5">
        <Thumb wish={wish} />
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold leading-snug">{wish.title}</p>
            {!showProgress && (
              <span
                className={cn(
                  "flex-none rounded-full px-2.5 py-1 text-xs font-semibold",
                  theme.accent,
                  theme.accentText,
                )}
              >
                {wish.targetNim} {wish.currency}
              </span>
            )}
          </div>
          {wish.description ? (
            <p className={cn("mt-1 line-clamp-2 text-[13px] leading-relaxed", theme.muted)}>
              {wish.description}
            </p>
          ) : null}
          <p className={cn("mt-1.5 text-xs", theme.muted)}>
            {GIFT_TYPE_LABEL[wish.giftType]}
          </p>
        </div>
      </div>

      {showProgress ? <Progress wish={wish} theme={theme} /> : null}

      {onGift ? (
        <span
          className={cn(
            "mt-3 flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition group-hover:brightness-105",
            theme.accent,
            theme.accentText,
          )}
        >
          {wish.fulfilled ? "Give a little extra" : "Send a gift"}
        </span>
      ) : null}
    </>
  );

  const base = cn(
    "flex h-full w-full flex-col rounded-3xl p-4 ring-1 ring-black/[0.06]",
    "bg-black/[0.025]",
  );

  if (!onGift) return <div className={base}>{body}</div>;

  return (
    <button
      type="button"
      onClick={() => onGift(wish.id)}
      aria-label={`Send a gift toward ${wish.title}`}
      className={cn(
        base,
        "group text-left transition hover:bg-black/[0.05] active:scale-[0.995]",
      )}
    >
      {body}
    </button>
  );
}

/**
 * The wishlist. Shared by the public page, the creator preview and the
 * marketing sample so what a creator previews is exactly what a visitor sees.
 */
export function WishList({
  wishes,
  theme: themeId,
  onGift,
  heading,
  className,
}: {
  wishes: WishCardData[];
  theme: string;
  onGift?: (wishId: string) => void;
  /** omit to hide the section heading entirely */
  heading?: React.ReactNode;
  className?: string;
}) {
  const theme = getTheme(themeId);
  if (wishes.length === 0) return null;

  return (
    <section className={className}>
      {heading}
      <ul className="grid gap-3 sm:grid-cols-2">
        {wishes.map((w) => (
          <li key={w.id}>
            <WishCard wish={w} theme={theme} onGift={onGift} />
          </li>
        ))}
      </ul>
    </section>
  );
}
