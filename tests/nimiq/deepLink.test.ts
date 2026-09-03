import { describe, it, expect } from "vitest";
import {
  createNimiqPayDeepLink,
  giftDeepLink,
  giftTargetUrl,
} from "@/lib/nimiq/deepLink";

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
