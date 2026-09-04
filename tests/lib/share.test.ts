import { describe, it, expect } from "vitest";
import {
  creatorShareText,
  prettyUrl,
  publicBirthdayUrl,
  sharePayload,
  visitorShareText,
  whatsappShareUrl,
} from "@/lib/share";
import { giftTargetUrl } from "@/lib/nimiq/deepLink";

describe("publicBirthdayUrl", () => {
  it("builds the canonical /b/<slug> link", () => {
    expect(publicBirthdayUrl("https://nimday.app", "sarah-2026")).toBe(
      "https://nimday.app/b/sarah-2026",
    );
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(publicBirthdayUrl("https://nimday.app/", "sarah")).toBe(
      "https://nimday.app/b/sarah",
    );
    expect(publicBirthdayUrl("https://nimday.app///", "sarah")).toBe(
      "https://nimday.app/b/sarah",
    );
  });

  it("escapes anything unusual in a slug", () => {
    expect(publicBirthdayUrl("https://nimday.app", "a b")).toBe(
      "https://nimday.app/b/a%20b",
    );
  });

  it("is the same base the Nimiq Pay gift link points at", () => {
    // One URL format for the public page — the deep link only adds gift context.
    const base = publicBirthdayUrl("https://nimday.app", "sarah");
    expect(giftTargetUrl("https://nimday.app", "sarah")).toBe(`${base}?gift=1`);
  });
});

describe("prettyUrl", () => {
  it("drops the scheme and trailing slash", () => {
    expect(prettyUrl("https://nimday.app/b/sarah")).toBe("nimday.app/b/sarah");
    expect(prettyUrl("http://localhost:3000/b/sarah/")).toBe("localhost:3000/b/sarah");
  });
});

describe("share text", () => {
  it("speaks as the creator in the first person", () => {
    expect(creatorShareText("Sarah Chen")).toContain("It's my birthday");
    expect(creatorShareText("Sarah Chen")).toContain("Sarah");
    expect(creatorShareText("Sarah Chen")).not.toContain("Chen");
  });

  it("speaks about the birthday person for a visitor", () => {
    expect(visitorShareText("Sarah Chen")).toContain("Sarah's birthday");
  });

  it("mentions no currency, price or wallet jargon", () => {
    for (const text of [creatorShareText("Sarah"), visitorShareText("Sarah")]) {
      expect(text.toLowerCase()).not.toMatch(/wallet|crypto|blockchain|nimiq pay/);
    }
  });
});

describe("sharePayload / fallback", () => {
  it("carries the canonical url and the right voice", () => {
    const url = publicBirthdayUrl("https://nimday.app", "sarah");
    expect(sharePayload("Sarah", url, "creator")).toEqual({
      title: "NIMday",
      text: creatorShareText("Sarah"),
      url,
    });
    expect(sharePayload("Sarah", url, "visitor").text).toBe(visitorShareText("Sarah"));
  });

  it("builds a WhatsApp intent with the text and link encoded", () => {
    const payload = sharePayload("Sarah", "https://nimday.app/b/sarah", "visitor");
    const link = whatsappShareUrl(payload);
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    const decoded = decodeURIComponent(link.slice("https://wa.me/?text=".length));
    expect(decoded).toBe(`${payload.text}\n${payload.url}`);
  });
});
