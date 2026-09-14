/**
 * Nimiq Pay Mini App deep links.
 *
 * Phase 0 confirmed two documented formats:
 *   custom scheme:  nimiqpay://miniapp?url=<target>
 *   https:          https://nimpay.app/miniapps/open/<target>
 *
 * DEVICE CHECK PENDING: whether the target's full path + query (e.g.
 * `/b/<slug>?gift=1&intent=<id>`) is preserved when Nimiq Pay opens the mini
 * app. All deep-link + gift-context construction lives here so it is a one-line
 * change if the target must be reshaped (e.g. context moved to the fragment).
 */

const HTTPS_BASE = "https://nimpay.app/miniapps/open/";
const CUSTOM_SCHEME = "nimiqpay://miniapp";

/** Where a visitor without Nimiq Pay installs it (as linked from nimpay.app). */
export const NIMIQ_PAY_STORE_LINKS = {
  ios: "https://apps.apple.com/app/nimiq-pay/id6471844738",
  android: "https://play.google.com/store/apps/details?id=com.nimiq.pay",
} as const;

export type DevicePlatform = "ios" | "android" | "desktop";

/**
 * Which store to offer. Nimiq Pay is phone-only, so anything that isn't iOS or
 * Android is treated as a computer that needs to hand off to a phone.
 */
export function detectPlatform(
  userAgent: string,
  maxTouchPoints = 0,
): DevicePlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  // iPadOS 13+ reports itself as a Mac; only the touch screen gives it away.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  return "desktop";
}

export type DeepLinkKind = "https" | "custom";

/**
 * Build a deep link that opens `targetUrl` as a mini app inside Nimiq Pay.
 * `targetUrl` must be an absolute https URL of a page in this app.
 */
export function createNimiqPayDeepLink(
  targetUrl: string,
  kind: DeepLinkKind = "https",
): string {
  const target = targetUrl.trim();
  if (kind === "custom") {
    return `${CUSTOM_SCHEME}?url=${encodeURIComponent(target)}`;
  }
  // The docs show the target appended raw after the base path.
  return `${HTTPS_BASE}${target}`;
}

export interface GiftDeepLinkOptions {
  /** payment-intent id to resume inside Nimiq Pay */
  intentId?: string;
  kind?: DeepLinkKind;
}

/**
 * The URL of the public nimDay page carrying gift context. The page reads
 * `?gift=1` to open the gift UI and `?intent=<id>` to resume a specific payment.
 */
export function giftTargetUrl(
  origin: string,
  slug: string,
  intentId?: string,
): string {
  const base = `${origin.replace(/\/+$/, "")}/b/${encodeURIComponent(slug)}`;
  const params = new URLSearchParams({ gift: "1" });
  if (intentId) params.set("intent", intentId);
  return `${base}?${params.toString()}`;
}

/** Deep link that opens a nimDay's gift flow inside Nimiq Pay. */
export function giftDeepLink(
  origin: string,
  slug: string,
  options: GiftDeepLinkOptions = {},
): string {
  return createNimiqPayDeepLink(
    giftTargetUrl(origin, slug, options.intentId),
    options.kind ?? "https",
  );
}
