"use client";

import { cn } from "@/components/ui";

/**
 * Day / month / year selector for a birthday.
 *
 * A native `<input type="date">` renders as a cramped `mm/dd/yyyy` box on
 * mobile and puts the year last, which is the hardest part to reach for a date
 * decades in the past. Three selects are predictable on every device, use the
 * platform's own wheel picker, and make the year a single scroll.
 *
 * Value is the same `YYYY-MM-DD` string the rest of the app uses.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EARLIEST_YEAR = 1900;

function daysInMonth(year: number, month: number): number {
  // month is 1-based; day 0 of the next month is the last day of this one.
  if (!year || !month) return 31;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parse(value: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return { y: 0, m: 0, d: 0 };
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function format(y: number, m: number, d: number): string {
  if (!y || !m || !d) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(
    d,
  ).padStart(2, "0")}`;
}

const selectStyle =
  "min-h-[48px] w-full appearance-none rounded-xl bg-white bg-[length:10px] bg-[right_0.9rem_center] bg-no-repeat px-3.5 py-2.5 text-[15px] text-ink ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-ink/30";

// Inline chevron so the control looks the same on every platform.
const chevron = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23241f1a' stroke-opacity='0.45' stroke-width='1.5' stroke-linecap='round'/></svg>\")",
};

export function DateField({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
}) {
  const { y, m, d } = parse(value);
  const thisYear = new Date().getUTCFullYear();
  const years: number[] = [];
  for (let year = thisYear; year >= EARLIEST_YEAR; year--) years.push(year);

  function update(next: { y?: number; m?: number; d?: number }) {
    const ny = next.y ?? y;
    const nm = next.m ?? m;
    // Clamp the day so 31 January -> February becomes the 28th or 29th,
    // rather than silently producing an impossible date.
    const maxDay = daysInMonth(ny, nm);
    const nd = Math.min(next.d ?? d, maxDay || 31);
    onChange(format(ny, nm, nd));
  }

  const dayCount = daysInMonth(y, m);

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_1.4fr_1fr] gap-2",
        invalid && "[&_select]:ring-red-400",
      )}
    >
      <select
        aria-label="Day"
        className={selectStyle}
        style={chevron}
        value={d || ""}
        onChange={(e) => update({ d: Number(e.target.value) })}
      >
        <option value="" disabled>
          Day
        </option>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <select
        aria-label="Month"
        className={selectStyle}
        style={chevron}
        value={m || ""}
        onChange={(e) => update({ m: Number(e.target.value) })}
      >
        <option value="" disabled>
          Month
        </option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>

      <select
        aria-label="Year"
        className={selectStyle}
        style={chevron}
        value={y || ""}
        onChange={(e) => update({ y: Number(e.target.value) })}
      >
        <option value="" disabled>
          Year
        </option>
        {years.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
