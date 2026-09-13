/**
 * The birthday picker's state rules.
 *
 * Regression: the picker used to keep day/month/year only inside the parent's
 * `YYYY-MM-DD` string. A partial date formats to "", so every single tap was
 * handed to the parent as "" and erased — on a new nimDay no date could ever be
 * chosen, in any order. These tests replay that exact one-tap-at-a-time flow,
 * including the parent echoing each value back.
 */
import { describe, it, expect } from "vitest";
import {
  EMPTY_PARTS,
  daysInMonth,
  formatDate,
  parseDate,
  partsForIncomingValue,
  pickPart,
  type DateParts,
} from "@/components/create/dateParts";

/**
 * Replay taps the way DateField and DetailsStep actually wire together:
 * pick -> maybe onChange(full) -> parent stores it -> value prop changes ->
 * picker reconciles. Returns what the buttons show and what the draft holds.
 */
function replay(taps: Partial<DateParts>[], startValue = "") {
  let parentValue = startValue; // draft.birthday
  let lastEmitted = startValue;
  let parts = parseDate(startValue);
  const trail: { parts: DateParts; value: string }[] = [];

  for (const tap of taps) {
    parts = pickPart(parts, tap);
    const full = formatDate(parts);
    if (full) {
      lastEmitted = full;
      parentValue = full;
    }
    // the value prop comes back from the parent
    parts = partsForIncomingValue(parentValue, lastEmitted, parts);
    lastEmitted = parentValue;
    trail.push({ parts, value: parentValue });
  }
  return trail;
}

describe("birthday picker — choosing a date one tap at a time", () => {
  it("keeps each pick on a new nimDay, and completes on the last one", () => {
    const trail = replay([{ d: 14 }, { m: 3 }, { y: 1996 }]);

    // the pick survives even though the draft can't hold it yet
    expect(trail[0]).toEqual({ parts: { y: 0, m: 0, d: 14 }, value: "" });
    expect(trail[1]).toEqual({ parts: { y: 0, m: 3, d: 14 }, value: "" });
    expect(trail[2]).toEqual({
      parts: { y: 1996, m: 3, d: 14 },
      value: "1996-03-14",
    });
  });

  it("works in any order", () => {
    const orders: Partial<DateParts>[][] = [
      [{ y: 1996 }, { m: 3 }, { d: 14 }],
      [{ m: 3 }, { y: 1996 }, { d: 14 }],
      [{ m: 3 }, { d: 14 }, { y: 1996 }],
    ];
    for (const taps of orders) {
      expect(replay(taps).at(-1)!.value).toBe("1996-03-14");
    }
  });

  it("never hands the parent a partial date", () => {
    for (const step of replay([{ d: 14 }, { m: 3 }])) {
      expect(step.value).toBe("");
    }
  });

  it("changes one part of a date that already exists", () => {
    const trail = replay([{ d: 20 }, { m: 7 }], "1996-03-14");
    expect(trail[0].value).toBe("1996-03-20");
    expect(trail[1].value).toBe("1996-07-20");
  });

  it("lets a person re-pick a part before finishing", () => {
    const trail = replay([{ d: 14 }, { d: 9 }, { m: 3 }, { y: 1996 }]);
    expect(trail.at(-1)!.value).toBe("1996-03-09");
  });
});

describe("birthday picker — values arriving from outside", () => {
  it("adopts a saved date that loads after the picker mounts", () => {
    // mounted with an empty draft, then CreateWizard loads the existing nimDay
    const parts = partsForIncomingValue("1996-03-14", "", EMPTY_PARTS);
    expect(parts).toEqual({ y: 1996, m: 3, d: 14 });
  });

  it("does not wipe a half-finished pick when its own echo comes back", () => {
    const halfway: DateParts = { y: 0, m: 3, d: 14 };
    expect(partsForIncomingValue("", "", halfway)).toBe(halfway);
  });

  it("resets when the draft is cleared from outside", () => {
    const parts = partsForIncomingValue("", "1996-03-14", { y: 1996, m: 3, d: 14 });
    expect(parts).toEqual(EMPTY_PARTS);
  });
});

describe("birthday picker — impossible dates", () => {
  it("clamps 31 January to the end of February", () => {
    expect(pickPart({ y: 2001, m: 1, d: 31 }, { m: 2 })).toEqual({ y: 2001, m: 2, d: 28 });
    expect(pickPart({ y: 2000, m: 1, d: 31 }, { m: 2 })).toEqual({ y: 2000, m: 2, d: 29 });
  });

  it("keeps 29 February pickable before the year is known, then clamps", () => {
    expect(daysInMonth(0, 2)).toBe(29);
    const feb29 = pickPart(EMPTY_PARTS, { m: 2, d: 29 });
    expect(feb29.d).toBe(29);
    expect(pickPart(feb29, { y: 2001 }).d).toBe(28); // not a leap year
    expect(pickPart(feb29, { y: 1996 }).d).toBe(29); // leap year
  });

  it("shows the right number of days once the month is known", () => {
    expect(daysInMonth(0, 4)).toBe(30);
    expect(daysInMonth(0, 0)).toBe(31);
    expect(daysInMonth(1996, 12)).toBe(31);
  });

  it("clamps an April 31 picked before the month", () => {
    expect(pickPart({ y: 0, m: 0, d: 31 }, { m: 4 }).d).toBe(30);
  });
});

describe("birthday picker — value format", () => {
  it("round-trips a complete date", () => {
    expect(formatDate(parseDate("1996-03-14"))).toBe("1996-03-14");
    expect(formatDate({ y: 2001, m: 1, d: 5 })).toBe("2001-01-05");
  });

  it("treats anything else as nothing chosen", () => {
    for (const bad of ["", "1996-3-14", "14/03/1996", "garbage", null, undefined]) {
      expect(parseDate(bad)).toEqual(EMPTY_PARTS);
    }
  });

  it("formats to empty until all three parts are chosen", () => {
    expect(formatDate({ y: 1996, m: 3, d: 0 })).toBe("");
    expect(formatDate({ y: 0, m: 3, d: 14 })).toBe("");
    expect(formatDate({ y: 1996, m: 0, d: 14 })).toBe("");
  });
});
