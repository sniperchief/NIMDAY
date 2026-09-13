"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { getBirthdayCountdown } from "@/lib/countdown";
import type { Theme } from "@/lib/themes";

/**
 * The birthday as a calendar tile — "OCT / 13" — for the next time it comes
 * round. Same date maths as <Countdown> (next occurrence, UTC), rechecked
 * hourly so the tile moves on to next year once the birthday has passed.
 */

function nextBirthday(birthdayISO: string): Date {
  return getBirthdayCountdown(new Date(`${birthdayISO}T00:00:00.000Z`), new Date())
    .nextDate;
}

function format(d: Date, options: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

export function DateTile({
  birthdayISO,
  theme,
  className,
}: {
  birthdayISO: string; // YYYY-MM-DD
  theme: Theme;
  className?: string;
}) {
  const [next, setNext] = useState(() => nextBirthday(birthdayISO));

  useEffect(() => {
    setNext(nextBirthday(birthdayISO));
    const t = setInterval(() => setNext(nextBirthday(birthdayISO)), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [birthdayISO]);

  return (
    <time
      dateTime={next.toISOString().slice(0, 10)}
      className={cn(
        "flex w-14 flex-none flex-col overflow-hidden rounded-xl bg-white text-center shadow-[0_6px_16px_-8px_rgba(36,31,26,0.35)] ring-1 ring-black/[0.08]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
          theme.accent,
          theme.accentText,
        )}
      >
        {format(next, { month: "short" })}
      </span>
      <span aria-hidden className={cn("py-1.5 font-display text-2xl leading-none", theme.text)}>
        {next.getUTCDate()}
      </span>
      <span className="sr-only">
        Birthday: {format(next, { weekday: "long", day: "numeric", month: "long" })}
      </span>
    </time>
  );
}
