/**
 * ============================================================================
 *  THE ONE PLACE that knows how Nimiq Pay's mini-app `sign()` encodes bytes.
 * ============================================================================
 *
 * Phase 0 proved (executed): a signature produced by signing the *raw UTF-8
 * bytes* of a message verifies server-side with
 *   `PublicKey.fromHex(pub).verify(Signature.fromHex(sig), bytes)`
 * and the signer address derives from `PublicKey.toAddress()`.
 *
 * DEVICE CHECK PENDING: the exact bytes Nimiq Pay's `sign()` signs are not yet
 * confirmed on a real device. It may sign the raw UTF-8 bytes, or it may hash /
 * prefix them (the Keyguard "\x19Nimiq Signed Message:\n" convention). Until we
 * know, `verifyNimiqSignature` tries every known candidate encoding and reports
 * which one matched. After the device test, set `PINNED_ENCODING` to lock it.
 *
 * Nothing else in the app should import `@nimiq/core` for signature work —
 * change encodings here only.
 */

import { createHash } from "node:crypto";
import { normalizeAddress } from "@/lib/nimiq/address";

export { normalizeAddress };

export type SignatureEncoding =
  | "raw-utf8"
  | "sha256-utf8"
  | "nimiq-signed-message"
  | "nimiq-signed-message-raw"
  | "eth-style-prefix";

export const SIGNATURE_ENCODINGS: SignatureEncoding[] = [
  "nimiq-signed-message",
  "raw-utf8",
  "sha256-utf8",
  "nimiq-signed-message-raw",
  "eth-style-prefix",
];

/** Set to a single encoding once confirmed on a Nimiq Pay device. */
export const PINNED_ENCODING: SignatureEncoding | null = null;

/**
 * Nimiq's signed-message convention follows Bitcoin's: the leading byte is
 * the *length* of the prefix string, not a fixed version byte. "Nimiq Signed
 * Message:" plus a newline is 22 characters, so that byte is 0x16.
 *
 * This previously used 0x19, Ethereum's EIP-191 version byte, which is a
 * different scheme entirely. That is why no candidate matched the first real
 * signature from a Nimiq Pay device.
 */
const NIMIQ_MSG_PREFIX = "\x16Nimiq Signed Message:\n";
/** The previous, incorrect prefix. Kept as a candidate so a match is reported. */
const ETH_STYLE_PREFIX = "\x19Nimiq Signed Message:\n";

/** Produce the exact byte buffer that `sign()` is assumed to have signed. */
export function encodeSignedMessage(
  message: string,
  encoding: SignatureEncoding,
): Uint8Array {
  const utf8 = new TextEncoder().encode(message);
  switch (encoding) {
    case "raw-utf8":
      return utf8;
    case "sha256-utf8":
      return new Uint8Array(createHash("sha256").update(utf8).digest());
    case "nimiq-signed-message": {
      const prefixed = new TextEncoder().encode(
        NIMIQ_MSG_PREFIX + utf8.length + message,
      );
      return new Uint8Array(createHash("sha256").update(prefixed).digest());
    }
    case "nimiq-signed-message-raw":
      // Same framing, signed directly rather than over a digest.
      return new TextEncoder().encode(NIMIQ_MSG_PREFIX + utf8.length + message);
    case "eth-style-prefix": {
      const prefixed = new TextEncoder().encode(
        ETH_STYLE_PREFIX + utf8.length + message,
      );
      return new Uint8Array(createHash("sha256").update(prefixed).digest());
    }
  }
}

export interface VerifyInput {
  message: string;
  /** hex, 32 bytes */
  publicKey: string;
  /** hex, 64 bytes */
  signature: string;
}

export type VerifyResult =
  | { valid: true; address: string; encoding: SignatureEncoding }
  | { valid: false; reason: "malformed" | "bad-signature" };

function isHex(s: string, bytes: number): boolean {
  return typeof s === "string" && new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`).test(s);
}

/**
 * Verify a Nimiq signature and derive the signer's user-friendly address.
 * Isolated so the crypto library import stays server-only and swappable.
 */
export async function verifyNimiqSignature(
  input: VerifyInput,
): Promise<VerifyResult> {
  if (!isHex(input.publicKey, 32) || !isHex(input.signature, 64)) {
    return { valid: false, reason: "malformed" };
  }

  const Nimiq = await import("@nimiq/core");

  let publicKey: import("@nimiq/core").PublicKey;
  let signature: import("@nimiq/core").Signature;
  let address: string;
  try {
    publicKey = Nimiq.PublicKey.fromHex(input.publicKey);
    signature = Nimiq.Signature.fromHex(input.signature);
    address = publicKey.toAddress().toUserFriendlyAddress();
  } catch {
    return { valid: false, reason: "malformed" };
  }

  const encodings = PINNED_ENCODING ? [PINNED_ENCODING] : SIGNATURE_ENCODINGS;
  for (const encoding of encodings) {
    const data = encodeSignedMessage(input.message, encoding);
    let ok = false;
    try {
      ok = publicKey.verify(signature, data);
    } catch {
      ok = false;
    }
    if (ok) return { valid: true, address, encoding };
  }

  return { valid: false, reason: "bad-signature" };
}

