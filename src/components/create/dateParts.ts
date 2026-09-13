/**
 * Pure state logic for the birthday picker. No React, no DOM — kept apart from
 * DateField.tsx so the rules can be unit-tested directly.
 *
 * The picker sets day, month and year one tap at a time, so it has to hold a
 * *partial* date. The app's value format (`YYYY-MM-DD`) cannot represent one,
 * which is why the parts live here and only a complete date is ever handed to
 * the parent.
 */

export interface DateParts {
  /** 0 = not chosen yet */
  y: number;
  m: number;
  d: number;
}

export const EMPTY_PARTS: DateParts = { y: 0, m: 0, d: 0 };

/**
 * Days in a month (1-based). With the month known but not the year, assume a
 * leap year so 29 February stays pickable; choosing a non-leap year later
 * clamps it. With no month, allow the full 31.
 */
export function daysInMonth(year: number, month: number): number {
  if (!month) return 31;
  return new Date(Date.UTC(year || 2000, month, 0)).getUTCDate();
}

export function parseDate(value: string | null | undefined): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return EMPTY_PARTS;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** `YYYY-MM-DD` when all three parts are chosen, otherwise "". */
export function formatDate({ y, m, d }: DateParts): string {
  if (!y || !m || !d) return "";
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/**
 * Apply one tap. Parts already chosen are kept, and the day is clamped so
 * 31 January -> February becomes the 28th or 29th rather than an impossible
 * date.
 */
export function pickPart(current: DateParts, next: Partial<DateParts>): DateParts {
  const y = next.y ?? current.y;
  const m = next.m ?? current.m;
  const wantDay = next.d ?? current.d;
  const d = wantDay ? Math.min(wantDay, daysInMonth(y, m)) : 0;
  return { y, m, d };
}

/**
 * What the picker should show when the parent's value changes.
 *
 * If the new value is just the picker's own last `onChange` coming back, keep
 * the local parts — this is what stops a half-finished pick from being wiped.
 * Anything else came from outside (a saved NIMday loading after mount, or the
 * draft being reset), so adopt it.
 */
export function partsForIncomingValue(
  value: string,
  lastEmitted: string,
  current: DateParts,
): DateParts {
  return value === lastEmitted ? current : parseDate(value);
}
