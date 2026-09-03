import { describe, it, expect } from "vitest";
import { getBirthdayCountdown, countdownLabel } from "@/lib/countdown";

describe("getBirthdayCountdown", () => {
  it("reports isToday when month/day match", () => {
    const now = new Date("2026-09-03T12:00:00Z");
    const c = getBirthdayCountdown(new Date("1994-09-03T00:00:00Z"), now);
    expect(c.isToday).toBe(true);
    expect(c.daysUntil).toBe(0);
  });

  it("counts days to a birthday later this year", () => {
    const now = new Date("2026-09-03T00:00:00Z");
    const c = getBirthdayCountdown(new Date("2000-09-13T00:00:00Z"), now);
    expect(c.daysUntil).toBe(10);
    expect(c.isToday).toBe(false);
  });

  it("rolls over to next year when the date has passed", () => {
    const now = new Date("2026-09-03T00:00:00Z");
    const c = getBirthdayCountdown(new Date("1990-01-01T00:00:00Z"), now);
    expect(c.nextDate.getUTCFullYear()).toBe(2027);
    expect(c.daysUntil).toBeGreaterThan(100);
  });

  it("derives the age they are turning", () => {
    const now = new Date("2026-09-03T00:00:00Z");
    const c = getBirthdayCountdown(new Date("2000-12-25T00:00:00Z"), now);
    expect(c.turningAge).toBe(26);
  });

  it("labels today and future days differently", () => {
    const today = { isToday: true, daysUntil: 0, nextDate: new Date(), turningAge: null };
    expect(countdownLabel("Sarah Lopez", today)).toContain("Today is Sarah");
    const soon = { isToday: false, daysUntil: 1, nextDate: new Date(), turningAge: null };
    expect(countdownLabel("Sarah", soon)).toBe("1 day until Sarah's birthday");
  });
});
