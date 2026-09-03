import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Birthday, Wish } from "@prisma/client";

const { findBirthday } = vi.hoisted(() => ({ findBirthday: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { birthday: { findUnique: findBirthday } },
}));

import {
  publishProblems,
  getPublishedBirthdayBySlug,
  toPublicBirthday,
  type BirthdayWithWishes,
} from "@/lib/birthday";

function birthday(over: Partial<Birthday> = {}): Birthday {
  return {
    id: "b1",
    creatorId: "u1",
    slug: "sarah-ab12",
    name: "Sarah",
    birthday: new Date("2000-09-13T00:00:00Z"),
    message: null,
    imageUrl: null,
    theme: "confetti",
    published: false,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function wish(over: Partial<Wish> = {}): Wish {
  return {
    id: Math.random().toString(36).slice(2),
    birthdayId: "b1",
    title: "A wish",
    imageUrl: null,
    description: null,
    // Prisma Decimal is represented loosely here; publishProblems only does Number()
    targetAmount: 10 as unknown as Wish["targetAmount"],
    currency: "NIM",
    giftType: "EITHER",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe("publishProblems", () => {
  it("passes a valid birthday with 0–5 wishes", () => {
    const b: BirthdayWithWishes = { ...birthday(), wishes: [wish(), wish()] };
    expect(publishProblems(b)).toEqual([]);
  });

  it("flags more than 5 wishes", () => {
    const b: BirthdayWithWishes = {
      ...birthday(),
      wishes: Array.from({ length: 6 }, () => wish()),
    };
    expect(publishProblems(b).join(" ")).toMatch(/at most 5 wishes/);
  });

  it("flags a wish with a non-positive target", () => {
    const b: BirthdayWithWishes = {
      ...birthday(),
      wishes: [wish({ title: "Bad", targetAmount: 0 as never })],
    };
    expect(publishProblems(b).join(" ")).toMatch(/target above 0/);
  });

  it("flags a missing name", () => {
    const b: BirthdayWithWishes = { ...birthday({ name: "  " }), wishes: [] };
    expect(publishProblems(b).join(" ")).toMatch(/name/i);
  });

  it("flags an unsupported currency (USDT)", () => {
    const b: BirthdayWithWishes = {
      ...birthday(),
      wishes: [wish({ currency: "USDT" })],
    };
    expect(publishProblems(b).join(" ")).toMatch(/unsupported currency/);
  });
});

describe("getPublishedBirthdayBySlug", () => {
  beforeEach(() => findBirthday.mockReset());

  it("returns null for an unpublished birthday", async () => {
    findBirthday.mockResolvedValue({ ...birthday({ published: false }), wishes: [] });
    expect(await getPublishedBirthdayBySlug("sarah-ab12")).toBeNull();
  });

  it("returns the birthday when published", async () => {
    findBirthday.mockResolvedValue({ ...birthday({ published: true }), wishes: [] });
    const b = await getPublishedBirthdayBySlug("sarah-ab12");
    expect(b?.name).toBe("Sarah");
  });

  it("returns null when the slug is unknown", async () => {
    findBirthday.mockResolvedValue(null);
    expect(await getPublishedBirthdayBySlug("nope")).toBeNull();
  });
});

describe("toPublicBirthday", () => {
  it("serialises wishes and omits internal fields", () => {
    const b: BirthdayWithWishes = {
      ...birthday(),
      wishes: [wish({ title: "Headphones", targetAmount: 120 as never })],
    };
    const pub = toPublicBirthday(b, new Date("2026-09-03T00:00:00Z"));
    expect(pub.slug).toBe("sarah-ab12");
    expect(pub.wishes[0]).toMatchObject({ title: "Headphones" });
    expect(pub.wishes[0]).not.toHaveProperty("sortOrder");
    expect(pub.countdown.daysUntil).toBe(10);
  });
});
