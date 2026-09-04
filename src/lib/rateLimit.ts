import "server-only";

/**
 * A deliberately small in-process rate limiter for the unauthenticated message
 * endpoint. It stops the obvious abuse (someone holding down "send") without
 * pretending to be infrastructure — see PHASE_3_RESULTS.md: per-instance only,
 * so it is not a defence for a multi-instance deployment.
 */

interface Bucket {
  hits: number[];
  /** recent normalised bodies, for the "same message twice" guard */
  recent: { text: string; at: number }[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

export interface RateLimitOptions {
  /** how many actions are allowed inside the window */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** seconds until the next attempt would be allowed */
  retryAfterSeconds: number;
}

function bucketFor(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size >= MAX_KEYS) buckets.clear(); // crude, bounded, good enough
    b = { hits: [], recent: [] };
    buckets.set(key, b);
  }
  return b;
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const b = bucketFor(key);
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    const oldest = b.hits[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }
  b.hits.push(now);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** True when this exact text was already submitted under this key recently. */
export function isDuplicateSubmission(
  key: string,
  text: string,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const b = bucketFor(key);
  b.recent = b.recent.filter((r) => now - r.at < windowMs);
  const seen = b.recent.some((r) => r.text === text);
  if (!seen) b.recent.push({ text, at: now });
  return seen;
}

/** Best-effort client identity for rate limiting. Never used for display. */
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip =
    fwd.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

/** Test-only reset so limiter state doesn't leak between cases. */
export function __resetRateLimits(): void {
  buckets.clear();
}
