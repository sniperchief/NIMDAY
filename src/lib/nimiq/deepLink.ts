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
