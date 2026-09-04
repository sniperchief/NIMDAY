import * as React from "react";
import { getTheme } from "@/lib/themes";
import { cn } from "@/components/ui";
import { ThemeMotif } from "@/components/ThemeMotif";
import { Countdown } from "@/components/Countdown";

export interface BirthdayCardData {
  name: string;
  birthday: string;
  message: string | null;
  theme: string;
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
 * The card itself: photo, name, countdown, message. Nothing about money.
 *
 * This is the first thing a visitor sees, and it has one job — say *whose*
 * birthday it is. Wishes, gifting, messages and the quest are separate sections
 * rendered underneath (or passed as `children`), so the page reads as a
 * birthday card first and a wishlist second.
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
        "shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]",
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

          <Countdown
            name={data.name || "the"}
            birthdayISO={data.birthday}
            className={cn("mt-4", theme.accent, theme.accentText)}
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

        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </article>
  );
}
