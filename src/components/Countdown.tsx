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

  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium " +
        (className ?? "")
      }
    >
      <span aria-hidden>{c.isToday ? "🎂" : "🎈"}</span>
      {countdownLabel(name, c)}
      {c.turningAge && !c.isToday ? (
        <span className="opacity-70">· turning {c.turningAge}</span>
      ) : null}
    </span>
  );
}
