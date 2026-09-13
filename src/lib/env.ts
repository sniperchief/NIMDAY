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

/**
 * The Nimiq networks nimDay knows how to run against. Anything else is a
 * configuration mistake, not a network — we refuse it loudly rather than
 * silently rejecting every payment as "wrong network" at verification time.
 */
export const NIMIQ_NETWORKS = ["mainalbatross", "testalbatross"] as const;
export type NimiqNetwork = (typeof NIMIQ_NETWORKS)[number];
export const NIMIQ_MAINNET: NimiqNetwork = "mainalbatross";

/**
 * Resolve and validate NIMIQ_NETWORK. Exported for tests; production code
 * should read `env.nimiqNetwork()` so there is exactly one answer per process.
 */
export function resolveNimiqNetwork(raw: string | undefined): NimiqNetwork {
  const value = (raw ?? "").trim();
  if (value === "") return NIMIQ_MAINNET;
  if ((NIMIQ_NETWORKS as readonly string[]).includes(value)) {
    return value as NimiqNetwork;
  }
  throw new Error(
    `NIMIQ_NETWORK is set to "${value}", which is not a Nimiq network. ` +
      `Use one of: ${NIMIQ_NETWORKS.join(", ")}.`,
  );
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

  /**
   * The one network the whole process agrees on — the verifier, the light
   * client and the UI badge all read this, so they can never disagree about
   * which chain a gift has to be on. Defaults to mainnet; an unrecognised
   * value throws instead of quietly failing every payment.
   */
  nimiqNetwork: (): NimiqNetwork => resolveNimiqNetwork(process.env.NIMIQ_NETWORK),

  /** True when nimDay is pointed at test NIM, which is worth nothing. */
  isTestnet: (): boolean => resolveNimiqNetwork(process.env.NIMIQ_NETWORK) !== NIMIQ_MAINNET,

  isProd: process.env.NODE_ENV === "production",
};
