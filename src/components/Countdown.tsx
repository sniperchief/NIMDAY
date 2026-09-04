"use client";

import { useEffect, useState } from "react";
import { getBirthdayCountdown, countdownLabel } from "@/lib/countdown";

/**
 * Live-updating countdown pill. Server passes the birthday date + name; this
 * recomputes on mount and hourly so the number stays right across midnight.
 */
export function Countdown({
  name,
  birthdayISO,
  className,
}: {
  name: string;
  birthdayISO: string; // YYYY-MM-DD
  className?: string;
}) {
  const compute = () =>
    getBirthdayCountdown(new Date(`${birthdayISO}T00:00:00.000Z`), new Date());

  const [c, setC] = useState(compute);

  useEffect(() => {
    setC(compute());
    const t = setInterval(() => setC(compute()), 60 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthdayISO]);

  // One centred text run, not a row of flex items. As `inline-flex` the label
  // and the age were separate items, so on a narrow screen the label wrapped
  // inside its own box while "· turning 30" stayed pinned alongside it. Laid
  // out as ordinary inline text it reflows like a sentence and stays centred:
  //
  //     🎈 112 days until Sarah's
  //        birthday · turning 30
  //
  // `mr-2` reproduces the old `gap-2` — JSX drops the newline between the emoji
  // and the label, so there is no extra space to double up with.
  return (
    <span
      className={
        "inline-block max-w-full rounded-full px-3.5 py-1.5 text-center text-sm font-medium " +
        (className ?? "")
      }
    >
      <span aria-hidden className="mr-2">
        {c.isToday ? "🎂" : "🎈"}
      </span>
      {countdownLabel(name, c)}
      {c.turningAge && !c.isToday ? (
        <span className="opacity-70">{` · turning ${c.turningAge}`}</span>
      ) : null}
    </span>
  );
}
