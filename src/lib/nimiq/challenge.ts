/**
 * Sign-In-With-Nimiq challenge: message format + the pure verification function.
 *
 * The route handler is responsible for loading / atomically consuming the nonce
 * from storage; `verifyChallenge` is pure (given the stored nonce) so it can be
 * unit-tested without a database.
 */

import {
  verifyNimiqSignature,
  normalizeAddress,
  type SignatureEncoding,
} from "./verifySignature";

export function buildChallengeMessage(nonce: string): string {
  return [
    "Sign in to NIMday",
    "",
    "This request will not trigger a transaction or cost any fees.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}

export interface ChallengeSubmission {
  nonce: string;
  publicKey: string;
  signature: string;
  address: string;
}

export interface StoredNonce {
  value: string;
  address: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export type ChallengeFailure =
  | "malformed"
  | "nonce_not_found"
  | "nonce_expired"
  | "nonce_used"
  | "bad_signature"
  | "address_mismatch";

export type ChallengeResult =
  | { ok: true; address: string; encoding: SignatureEncoding }
  | { ok: false; reason: ChallengeFailure };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export async function verifyChallenge(
  submission: ChallengeSubmission,
  stored: StoredNonce | null,
  now: Date = new Date(),
): Promise<ChallengeResult> {
  if (
    !submission ||
    !isNonEmptyString(submission.nonce) ||
    !isNonEmptyString(submission.publicKey) ||
    !isNonEmptyString(submission.signature) ||
    !isNonEmptyString(submission.address)
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (!stored || stored.value !== submission.nonce) {
    return { ok: false, reason: "nonce_not_found" };
  }
  if (stored.usedAt) {
    return { ok: false, reason: "nonce_used" };
  }
  if (stored.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "nonce_expired" };
  }

  const message = buildChallengeMessage(submission.nonce);
  const result = await verifyNimiqSignature({
    message,
    publicKey: submission.publicKey,
    signature: submission.signature,
  });

  if (!result.valid) {
    return {
      ok: false,
      reason: result.reason === "malformed" ? "malformed" : "bad_signature",
    };
  }

  const derived = normalizeAddress(result.address);
  const claimed = normalizeAddress(submission.address);
  if (!derived || !claimed || derived !== claimed) {
    return { ok: false, reason: "address_mismatch" };
  }

  return { ok: true, address: derived, encoding: result.encoding };
}
