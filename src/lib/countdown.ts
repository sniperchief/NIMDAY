/** Birthday countdown helpers. Date-only maths in UTC so results are deterministic. */

export interface Countdown {
  isToday: boolean;
  /** whole days until the next occurrence (0 when today) */
  daysUntil: number;
  /** the next occurrence, as a UTC date at midnight */
  nextDate: Date;
  /** age they turn on the next occurrence, if a birth year is known and in the past */
  turningAge: number | null;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function getBirthdayCountdown(
  birthday: Date,
  now: Date = new Date(),
): Countdown {
  const today = utcMidnight(now);
  const month = birthday.getUTCMonth();
  const day = birthday.getUTCDate();

  // Candidate: this year's occurrence.
  let next = new Date(Date.UTC(today.getUTCFullYear(), month, day));

  // Handle Feb 29 birthdays in non-leap years -> celebrate Feb 28.
  if (next.getUTCMonth() !== month) {
    next = new Date(Date.UTC(today.getUTCFullYear(), month, day - 1));
  }

  if (next.getTime() < today.getTime()) {
    // already passed this year -> next year
    next = new Date(Date.UTC(today.getUTCFullYear() + 1, month, day));
    if (next.getUTCMonth() !== month) {
      next = new Date(Date.UTC(today.getUTCFullYear() + 1, month, day - 1));
    }
  }

  const daysUntil = Math.round(
    (next.getTime() - today.getTime()) / 86_400_000,
  );

  const birthYear = birthday.getUTCFullYear();
  let turningAge: number | null = null;
  if (birthYear > 1900 && birthYear <= next.getUTCFullYear()) {
    const age = next.getUTCFullYear() - birthYear;
    turningAge = age > 0 && age < 150 ? age : null;
  }

  return { isToday: daysUntil === 0, daysUntil, nextDate: next, turningAge };
}

export function countdownLabel(name: string, c: Countdown): string {
  const first = name.trim().split(/\s+/)[0] || name;
  if (c.isToday) return `🎂 Today is ${first}'s birthday!`;
  if (c.daysUntil === 1) return `1 day until ${first}'s birthday`;
  return `${c.daysUntil} days until ${first}'s birthday`;
}
