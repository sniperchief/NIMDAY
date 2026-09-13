import * as React from "react";
import { getTheme, type Theme } from "@/lib/themes";
import { cn } from "@/components/ui";
import { ThemeMotif } from "@/components/ThemeMotif";
import { DateTile } from "@/components/DateTile";

export interface BirthdayCardData {
  name: string;
  birthday: string;
  message: string | null;
  /** a saved theme id, or a theme object */
  theme: string | Theme;
  imageUrl: string | null;
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

/**
 * The card itself: photo, name, date, message. Nothing about money.
 *
 * This is the first thing a visitor sees, and it has one job — say *whose*
 * birthday it is. Wishes, gifting, messages and the quest are separate sections
 * rendered underneath (or passed as `children`), so the page reads as a
 * birthday card first and a wishlist second.
 *
 * One design everywhere: the homepage sample, the creator's preview and the
 * public page render this same card, so the homepage shows exactly what people
 * get.
 */
export function BirthdayCard({
  data,
  children,
  className,
  compact = false,
}: {
  data: BirthdayCardData;
  children?: React.ReactNode;
  className?: string;
  /** tighter spacing, for previews and the marketing sample */
  compact?: boolean;
}) {
  const theme = getTheme(data.theme);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[28px] ring-1 ring-black/5",
        "shadow-[0_60px_120px_-30px_rgba(36,31,26,0.5),0_28px_56px_-28px_rgba(36,31,26,0.35)]",
        theme.card,
        theme.text,
        className,
      )}
    >
      <div className="relative h-28">
        <ThemeMotif theme={theme} />
      </div>

      <div
        className={cn(
          "-mt-14 px-5 sm:px-8",
          compact ? "pb-7" : "pb-8",
        )}
      >
        <div className="flex flex-col items-center text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-white shadow-md ring-4 ring-white">
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

          <p className={cn("mt-4 text-[13px] uppercase tracking-[0.14em]", theme.muted)}>
            It&apos;s a birthday
          </p>
          <h1
            className={cn(
              "mt-1.5 text-[34px] font-semibold leading-[1.1] sm:text-[42px]",
              theme.heading,
            )}
          >
            {data.name || "Someone special"}
          </h1>

          <DateTile birthdayISO={data.birthday} theme={theme} className="mt-4" />

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

        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </article>
  );
}
