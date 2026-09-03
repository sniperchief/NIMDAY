/** Centralised environment access with sensible dev defaults. */

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  /** Public origin, no trailing slash. Used to build share + deep links. */
  appOrigin: (
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000"
  ).replace(/\/+$/, ""),

  authSecret: () =>
    required(
      "AUTH_SECRET",
      process.env.NODE_ENV === "production"
        ? undefined
        : "dev-only-insecure-secret-please-change-me-0000000",
    ),

  sessionTtlSeconds: () => int("SESSION_TTL_SECONDS", 60 * 60 * 24 * 7),
  authNonceTtlSeconds: () => int("AUTH_NONCE_TTL_SECONDS", 60 * 5),

  storageDriver: () => process.env.STORAGE_DRIVER ?? "local",

  isProd: process.env.NODE_ENV === "production",
};
