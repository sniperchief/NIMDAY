"use client";

/**
 * Thin client-side wrapper around the official Nimiq Mini App SDK.
 * Everything the UI needs from the wallet goes through here, with typed errors
 * so components never surface raw provider messages to users.
 */

import { init } from "@nimiq/mini-app-sdk";

export type WalletErrorCode =
  | "unavailable" // not running inside Nimiq Pay
  | "rejected" // user declined the native dialog
  | "consensus" // Nimiq network not ready yet
  | "no-account" // provider returned no address
  | "unknown";

export class WalletError extends Error {
  code: WalletErrorCode;
  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

interface NimiqProviderLike {
  listAccounts(): Promise<string[] | { error: { type: string; message: string } }>;
  sign(
    message: string,
  ): Promise<
    { publicKey: string; signature: string } | { error: { type: string; message: string } }
  >;
  isConsensusEstablished(): Promise<boolean>;
}

let providerPromise: Promise<NimiqProviderLike> | null = null;

function getProvider(): Promise<NimiqProviderLike> {
  if (!providerPromise) {
    providerPromise = init({ timeout: 4000 })
      .then((p) => p as unknown as NimiqProviderLike)
      .catch((err) => {
        providerPromise = null;
        throw new WalletError(
          "unavailable",
          err instanceof Error ? err.message : "Nimiq Pay not detected",
        );
      });
  }
  return providerPromise;
}

/** Quick, non-throwing check for whether we're inside Nimiq Pay. */
export function isNimiqPayAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as { nimiq?: unknown }).nimiq !== "undefined"
  );
}

function isProviderError(
  v: unknown,
): v is { error: { type: string; message: string } } {
  return typeof v === "object" && v !== null && "error" in v;
}

function mapThrown(err: unknown): WalletError {
  if (err instanceof WalletError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const lc = message.toLowerCase();
  if (
    lc.includes("denied") ||
    lc.includes("reject") ||
    lc.includes("permission") ||
    lc.includes("cancel")
  ) {
    return new WalletError("rejected", "Request was declined");
  }
  return new WalletError("unknown", message);
}

export async function getConsensusReady(): Promise<boolean> {
  try {
    const provider = await getProvider();
    return await provider.isConsensusEstablished();
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<{ address: string }> {
  const provider = await getProvider();
  let result: Awaited<ReturnType<NimiqProviderLike["listAccounts"]>>;
  try {
    result = await provider.listAccounts();
  } catch (err) {
    throw mapThrown(err);
  }
  if (isProviderError(result)) {
    throw new WalletError("rejected", result.error.message || "Request was declined");
  }
  const address = Array.isArray(result) ? result[0] : undefined;
  if (!address) throw new WalletError("no-account", "No Nimiq account was returned");
  return { address };
}

export async function signMessage(
  message: string,
): Promise<{ publicKey: string; signature: string }> {
  const provider = await getProvider();
  let result: Awaited<ReturnType<NimiqProviderLike["sign"]>>;
  try {
    result = await provider.sign(message);
  } catch (err) {
    throw mapThrown(err);
  }
  if (isProviderError(result)) {
    throw new WalletError("rejected", result.error.message || "Signing was declined");
  }
  if (!result.publicKey || !result.signature) {
    throw new WalletError("unknown", "Signature response was incomplete");
  }
  return { publicKey: result.publicKey, signature: result.signature };
}

export function friendlyWalletMessage(code: WalletErrorCode): string {
  switch (code) {
    case "unavailable":
      return "Open this page inside Nimiq Pay to connect your wallet.";
    case "rejected":
      return "No problem — you can try connecting again whenever you're ready.";
    case "consensus":
      return "Nimiq is still connecting. Give it a moment and try again.";
    case "no-account":
      return "We couldn't find a Nimiq account. Check your Nimiq Pay wallet and retry.";
    default:
      return "Something went wrong talking to Nimiq Pay. Please try again.";
  }
}
