import * as React from "react";
import { getTheme, type Theme } from "@/lib/themes";
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
    <div className="h-14 w-14 flex-none overflow-hidden rounded-xl bg-black/[0.06]">
      {wish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={wish.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xl opacity-35">
          🎁
        </div>
      )}
    </div>
  );
}

function ProgressBar({
  wish,
  theme,
  className,
}: {
  wish: WishCardData;
  theme: Theme;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, wish.progressPct ?? 0));
  return (
    <div
      className={cn("overflow-hidden rounded-full bg-black/[0.08]", className)}
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
  );
}

/** "85 / 120 NIM", "Fulfilled", or just the target where there's no progress yet. */
function Amount({ wish, theme }: { wish: WishCardData; theme: Theme }) {
  const hasProgress = wish.raisedNim !== undefined;
  return (
    <p className={cn("flex-none text-[12px] tabular-nums", theme.muted)}>
      {!hasProgress ? (
        <>
          {wish.targetNim} {wish.currency}
        </>
      ) : wish.fulfilled ? (
        <span className="font-semibold">Fulfilled</span>
      ) : (
        <>
          <span className="font-semibold">{wish.raisedNim}</span> / {wish.targetNim} NIM
        </>
      )}
    </p>
  );
}

function WishRow({
  wish,
  theme,
  onGift,
}: {
  wish: WishCardData;
  theme: Theme;
  onGift?: (wishId: string) => void;
}) {
  const hasProgress = wish.raisedNim !== undefined;

  const body = (
    <div className="flex items-center gap-3">
      <Thumb wish={wish} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[14px] font-semibold leading-snug">
            {wish.title}
          </p>
          {onGift ? (
            // Visual only — the whole row is the button, so there is one big
            // tap target rather than a small one nested inside another.
            <span
              aria-hidden
              className={cn(
                "flex-none rounded-full px-3 py-1 text-[12px] font-semibold transition group-hover:brightness-110",
                theme.accent,
                theme.accentText,
              )}
            >
              Gift
            </span>
          ) : null}
        </div>
        {wish.description ? (
          <p className={cn("mt-0.5 line-clamp-2 text-[12px] leading-relaxed", theme.muted)}>
            {wish.description}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2.5">
          {hasProgress ? (
            <ProgressBar wish={wish} theme={theme} className="h-1.5 flex-1" />
          ) : (
            <span className="flex-1" />
          )}
          <Amount wish={wish} theme={theme} />
        </div>
      </div>
    </div>
  );

  const base =
    "block w-full rounded-2xl bg-black/[0.025] p-3 text-left ring-1 ring-black/[0.06]";

  if (!onGift) return <div className={base}>{body}</div>;

  return (
    <button
      type="button"
      onClick={() => onGift(wish.id)}
      aria-label={`Send a gift toward ${wish.title}`}
      className={cn(
        base,
        "group min-h-[44px] transition hover:bg-black/[0.05] active:scale-[0.995]",
      )}
    >
      {body}
    </button>
  );
}

/**
 * The wishlist: one compact row per wish. The homepage sample, the creator's
 * preview and the public page all render these identical rows, so what people
 * see on the homepage is exactly the card they get.
 */
export function WishList({
  wishes,
  theme: themeId,
  onGift,
  heading,
  className,
}: {
  wishes: WishCardData[];
  /** a saved theme id, or a theme object */
  theme: string | Theme;
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
      <ul className="grid gap-2.5">
        {wishes.map((w) => (
          <li key={w.id}>
            <WishRow wish={w} theme={theme} onGift={onGift} />
          </li>
        ))}
      </ul>
    </section>
  );
}
