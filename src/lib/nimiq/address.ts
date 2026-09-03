/**
 * Nimiq user-friendly address helpers — pure string work, no `@nimiq/core`.
 * Kept dependency-free so it can be pulled into API-route and client bundles
 * without dragging the WASM crypto package into their build traces.
 */

/** Normalise a Nimiq user-friendly address for comparison / storage. */
export function normalizeAddress(address: string): string | null {
  if (typeof address !== "string") return null;
  const compact = address.replace(/\s+/g, "").toUpperCase();
  if (!/^NQ[0-9A-Z]{34}$/.test(compact)) return null;
  // regroup into "NQxx xxxx ..." for canonical storage
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

/** "NQ12 3ABC …" -> "NQ12…" + last group. Enough to tell givers apart. */
export function maskAddress(address: string): string {
  const compact = address.replace(/\s+/g, "");
  if (compact.length < 12) return "NQ…";
  return `${compact.slice(0, 4)}…${compact.slice(-4)}`;
}
