/**
 * Wallet error classification. Pure — no SDK import — so it can be unit-tested
 * and so the provider wrapper stays a thin shim over the official SDK.
 *
 * Nimiq Pay does not reject with `Error` instances. A real device rejected a
 * transaction with a plain object, which `String(err)` turned into the useless
 * "[object Object]". Worse, every keyword rule below ran against that string,
 * so an ordinary declined transaction was reported as an unknown failure. The
 * text has to be extracted before anything can be classified.
 */

import { TxResultError } from "@/lib/nimiq/txResult";

const UNREADABLE = "an error it gave no details for";

export type WalletErrorCode =
  | "unavailable" // not running inside Nimiq Pay
  | "rejected" // user declined the native dialog
  | "consensus" // Nimiq network not ready yet
  | "no-account" // provider returned no address
  | "insufficient" // not enough NIM to cover the gift + fee
  | "invalid-tx" // the wallet rejected the transaction as malformed
  | "tx-result" // sendBasicTransactionWithData returned something unexpected
  | "unknown";

export class WalletError extends Error {
  code: WalletErrorCode;
  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

/** The `{ error: { type, message } }` envelope the SDK uses. */
export function isProviderError(
  v: unknown,
): v is { error: { type?: string; message?: string } } {
  return (
    typeof v === "object" &&
    v !== null &&
    "error" in v &&
    typeof (v as { error: unknown }).error === "object"
  );
}

/**
 * Get readable text out of whatever was thrown. Never returns
 * "[object Object]" — an opaque object is serialised so a human can read it.
 */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;

  if (isProviderError(err)) {
    const { type, message } = err.error ?? {};
    const parts = [type, message].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    if (parts.length) return parts.join(": ");
  }

  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    for (const key of ["message", "reason", "description", "type", "code"]) {
      const v = obj[key];
      if (typeof v === "string" && v.length > 0) return v;
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}" && json !== "null") return json;
    } catch {
      /* circular or otherwise unserialisable — fall through */
    }
  }

  if (err === undefined) return "No error detail";
  // String() throws on a null-prototype object, and yields "[object Object]"
  // for a plain one. Neither is allowed to escape this function.
  try {
    const text = String(err);
    return text === "[object Object]" ? UNREADABLE : text;
  } catch {
    return UNREADABLE;
  }
}

/** Classify anything thrown by the wallet into a typed WalletError. */
export function classifyWalletError(err: unknown): WalletError {
  if (err instanceof WalletError) return err;
  if (err instanceof TxResultError) {
    return new WalletError("tx-result", err.message);
  }

  const text = errorText(err);
  const lc = text.toLowerCase();

  if (
    lc.includes("denied") ||
    lc.includes("reject") ||
    lc.includes("declin") ||
    lc.includes("permission") ||
    lc.includes("abort") ||
    lc.includes("dismiss") ||
    lc.includes("cancel")
  ) {
    return new WalletError("rejected", text);
  }
  if (
    lc.includes("insufficient") ||
    lc.includes("balance") ||
    lc.includes("funds")
  ) {
    return new WalletError("insufficient", text);
  }
  if (lc.includes("consensus") || lc.includes("not established")) {
    return new WalletError("consensus", text);
  }
  if (
    lc.includes("invalid") ||
    lc.includes("malformed") ||
    lc.includes("recipient") ||
    lc.includes("address")
  ) {
    return new WalletError("invalid-tx", text);
  }
  return new WalletError("unknown", text);
}

export function friendlyWalletMessage(code: WalletErrorCode): string {
  switch (code) {
    case "unavailable":
      return "Open this page inside Nimiq Pay to send a gift.";
    case "rejected":
      return "No problem — nothing was sent. You can try again whenever you're ready.";
    case "consensus":
      return "Nimiq is still connecting. Give it a moment and try again.";
    case "no-account":
      return "We couldn't find a Nimiq account. Check your Nimiq Pay wallet and retry.";
    case "insufficient":
      return "There isn't enough NIM in your wallet for this gift.";
    case "invalid-tx":
      return "The wallet couldn't build that transaction. Try a different amount.";
    case "tx-result":
      return "The gift may have been sent, but we couldn't read the confirmation. Check your wallet before retrying.";
    default:
      return "Something went wrong talking to Nimiq Pay. Please try again.";
  }
}

/**
 * Friendly text, plus the wallet's own words when we don't recognise what it
 * said. NIMday runs inside a webview where nobody can open a console, so for
 * the two codes that mean "we have never seen this" the raw detail is the only
 * way anyone finds out what happened.
 */
export function describeWalletError(err: WalletError): string {
  const friendly = friendlyWalletMessage(err.code);
  if (err.code !== "unknown" && err.code !== "tx-result") return friendly;
  const detail = err.message?.trim();
  if (!detail || detail === friendly) return friendly;
  return `${friendly}\n\nNimiq Pay said: ${detail}`;
}
