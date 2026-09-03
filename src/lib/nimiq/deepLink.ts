/**
 * Nimiq Pay Mini App deep links.
 *
 * Phase 0 confirmed two documented formats:
 *   custom scheme:  nimiqpay://miniapp?url=<target>
 *   https:          https://nimpay.app/miniapps/open/<target>
 *
 * DEVICE CHECK PENDING: whether the target's full path + query (e.g.
 * `/b/<slug>?gift=1`) is preserved when Nimiq Pay opens the mini app. Keep all
 * deep-link construction here so it is a one-line change if the target needs to
 * be reshaped (e.g. slug moved to a fragment).
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

/** Deep link for the gift flow of a specific NIMday (Phase 2 will use this). */
export function giftDeepLink(
  origin: string,
  slug: string,
  kind: DeepLinkKind = "https",
): string {
  const target = `${origin.replace(/\/+$/, "")}/b/${encodeURIComponent(slug)}?gift=1`;
  return createNimiqPayDeepLink(target, kind);
}
