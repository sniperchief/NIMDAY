import { describe, it, expect } from "vitest";
import {
  wishInputSchema,
  createBirthdaySchema,
  parseBirthdayDate,
  formatBirthdayDate,
} from "@/lib/validation";

const baseWish = {
  title: "Headphones",
  targetAmount: 120,
  currency: "NIM" as const,
};

describe("wishInputSchema", () => {
  it("accepts a valid NIM wish", () => {
    expect(wishInputSchema.safeParse(baseWish).success).toBe(true);
  });

  it("ignores the retired gift type an older client may still send", () => {
    const res = wishInputSchema.safeParse({ ...baseWish, giftType: "BUY" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).not.toHaveProperty("giftType");
  });

  it("rejects a non-positive target", () => {
    expect(wishInputSchema.safeParse({ ...baseWish, targetAmount: 0 }).success).toBe(
      false,
    );
    expect(
      wishInputSchema.safeParse({ ...baseWish, targetAmount: -5 }).success,
    ).toBe(false);
  });

  it("rejects USDT for now", () => {
    const res = wishInputSchema.safeParse({ ...baseWish, currency: "USDT" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/USDT/i);
    }
  });

  it("rejects an unknown currency", () => {
    expect(
      wishInputSchema.safeParse({ ...baseWish, currency: "BTC" }).success,
    ).toBe(false);
  });

  it("rejects a missing title", () => {
    expect(wishInputSchema.safeParse({ ...baseWish, title: "" }).success).toBe(
      false,
    );
  });
});

describe("createBirthdaySchema", () => {
  const base = {
    name: "Sarah",
    birthday: "2000-09-13",
    theme: "confetti",
    wishes: [],
  };

  it("accepts a minimal valid birthday", () => {
    expect(createBirthdaySchema.safeParse(base).success).toBe(true);
  });

  it("rejects more than 5 wishes", () => {
    const wishes = Array.from({ length: 6 }, () => baseWish);
    expect(createBirthdaySchema.safeParse({ ...base, wishes }).success).toBe(
      false,
    );
  });

  it("rejects an unknown theme", () => {
    expect(
      createBirthdaySchema.safeParse({ ...base, theme: "neon" }).success,
    ).toBe(false);
  });

  it("rejects an invalid date", () => {
    expect(
      createBirthdaySchema.safeParse({ ...base, birthday: "2000-13-40" }).success,
    ).toBe(false);
  });
});

describe("birthday date helpers", () => {
  it("round-trip formats to YYYY-MM-DD in UTC", () => {
    expect(formatBirthdayDate(parseBirthdayDate("2000-09-13"))).toBe(
      "2000-09-13",
    );
  });
});
