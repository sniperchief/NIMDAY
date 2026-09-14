import { describe, it, expect } from "vitest";
import {
  NIMIQ_PAY_STORE_LINKS,
  createNimiqPayDeepLink,
  detectPlatform,
  giftDeepLink,
  giftTargetUrl,
} from "@/lib/nimiq/deepLink";

describe("detectPlatform", () => {
  it("recognises phones", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      ),
    ).toBe("ios");
    expect(
      detectPlatform(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
      ),
    ).toBe("android");
  });

  it("treats a touch-screen 'Mac' as an iPad, and a real Mac as a computer", () => {
    const macUa =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15";
    expect(detectPlatform(macUa, 5)).toBe("ios");
    expect(detectPlatform(macUa, 0)).toBe("desktop");
  });

  it("falls back to desktop for everything else", () => {
    expect(
      detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36"),
    ).toBe("desktop");
    expect(detectPlatform("")).toBe("desktop");
  });

  it("store links point at the official listings", () => {
    expect(NIMIQ_PAY_STORE_LINKS.ios).toMatch(/^https:\/\/apps\.apple\.com\//);
    expect(NIMIQ_PAY_STORE_LINKS.android).toContain("id=com.nimiq.pay");
  });
});

describe("createNimiqPayDeepLink", () => {
  const target = "https://nimday.app/b/sarah-ab12?gift=1";

  it("builds the https form by appending the raw target", () => {
    expect(createNimiqPayDeepLink(target)).toBe(
      `https://nimpay.app/miniapps/open/${target}`,
    );
  });

  it("builds the custom-scheme form with an encoded url param", () => {
    expect(createNimiqPayDeepLink(target, "custom")).toBe(
      `nimiqpay://miniapp?url=${encodeURIComponent(target)}`,
    );
  });
});

describe("gift deep links", () => {
  it("target url carries gift context", () => {
    expect(giftTargetUrl("https://nimday.app/", "sarah-ab12")).toBe(
      "https://nimday.app/b/sarah-ab12?gift=1",
    );
    expect(giftTargetUrl("https://nimday.app", "sarah-ab12", "int_9")).toBe(
      "https://nimday.app/b/sarah-ab12?gift=1&intent=int_9",
    );
  });

  it("giftDeepLink wraps the gift target for Nimiq Pay", () => {
    expect(giftDeepLink("https://nimday.app", "sarah-ab12", { intentId: "int_9" })).toBe(
      "https://nimpay.app/miniapps/open/https://nimday.app/b/sarah-ab12?gift=1&intent=int_9",
    );
  });

  it("giftDeepLink still works with no options (Phase 1 call site)", () => {
    expect(giftDeepLink("https://nimday.app/", "sarah-ab12")).toBe(
      "https://nimpay.app/miniapps/open/https://nimday.app/b/sarah-ab12?gift=1",
    );
  });
});
