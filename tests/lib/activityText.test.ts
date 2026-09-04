import { describe, it, expect } from "vitest";
import {
  activityEmoji,
  activityLine,
  excerpt,
  timeAgo,
  type ActivityItem,
} from "@/lib/activityText";

const at = "2026-09-03T12:00:00.000Z";

describe("activityLine", () => {
  it("names a gift with its wish", () => {
    const item: ActivityItem = {
      id: "1",
      kind: "gift",
      at,
      actor: "NQ55…0001",
      amountNim: "4",
      wishTitle: "Headphones",
    };
    expect(activityLine(item)).toBe("NQ55…0001 gifted 4 NIM toward Headphones");
  });

  it("says 'Someone' for an anonymous gift and never invents an identity", () => {
    const line = activityLine({
      id: "1",
      kind: "gift",
      at,
      actor: null,
      amountNim: "4",
      wishTitle: "Headphones",
    });
    expect(line).toBe("Someone gifted 4 NIM toward Headphones");
    expect(line).not.toMatch(/NQ/);
  });

  it("flags a reversed gift instead of quietly dropping it", () => {
    expect(
      activityLine({
        id: "1",
        kind: "gift",
        at,
        actor: null,
        amountNim: "4",
        wishTitle: "Headphones",
        reversed: true,
      }),
    ).toContain("later reversed by the network");
  });

  it("keeps an anonymous message anonymous", () => {
    expect(
      activityLine({ id: "2", kind: "message", at, actor: null }),
    ).toBe("Someone left you a birthday message");
    expect(activityLine({ id: "2", kind: "message", at, actor: "Alex" })).toBe(
      "Alex left you a birthday message",
    );
  });

  it("announces a fulfilled wish", () => {
    expect(
      activityLine({ id: "3", kind: "fulfilled", at, actor: null, wishTitle: "Headphones" }),
    ).toBe("Headphones wish fulfilled");
  });
});

describe("activityEmoji", () => {
  it("gives each kind its own icon", () => {
    expect(activityEmoji("gift")).toBe("🎁");
    expect(activityEmoji("message")).toBe("💌");
    expect(activityEmoji("fulfilled")).toBe("🎉");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-09-03T12:00:00.000Z");
  const ago = (ms: number) => timeAgo(new Date(now - ms).toISOString(), now);

  it("reads naturally across the ranges", () => {
    expect(ago(5_000)).toBe("just now");
    expect(ago(60_000)).toBe("1 min ago");
    expect(ago(12 * 60_000)).toBe("12 min ago");
    expect(ago(60 * 60_000)).toBe("1 hour ago");
    expect(ago(5 * 60 * 60_000)).toBe("5 hours ago");
    expect(ago(26 * 60 * 60_000)).toBe("yesterday");
    expect(ago(4 * 24 * 60 * 60_000)).toBe("4 days ago");
  });

  it("doesn't produce negative times from clock skew", () => {
    expect(timeAgo(new Date(now + 5_000).toISOString(), now)).toBe("just now");
  });

  it("returns nothing for an unparseable timestamp", () => {
    expect(timeAgo("not a date", now)).toBe("");
  });
});

describe("excerpt", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(excerpt("Happy   birthday!")).toBe("Happy birthday!");
  });

  it("truncates with an ellipsis", () => {
    const long = "a".repeat(200);
    const out = excerpt(long, 20);
    expect([...out]).toHaveLength(20);
    expect(out.endsWith("…")).toBe(true);
  });
});
