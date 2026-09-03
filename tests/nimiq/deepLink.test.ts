import { describe, it, expect } from "vitest";
import {
  createNimiqPayDeepLink,
  giftDeepLink,
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

  it("giftDeepLink points at /b/<slug>?gift=1 on the given origin", () => {
    const link = giftDeepLink("https://nimday.app/", "sarah-ab12");
    expect(link).toBe(
      "https://nimpay.app/miniapps/open/https://nimday.app/b/sarah-ab12?gift=1",
    );
  });
});
