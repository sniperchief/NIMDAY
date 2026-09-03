import { randomBytes } from "node:crypto";

/**
 * Compact payment identifier carried in the transaction data field.
 *   memo = "nimday:" + shortId
 * 7 + 14 = 21 bytes — well under the 40/64-byte target for basic-tx data.
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"; // 35, lowercase, unambiguous enough
export const SHORT_ID_LENGTH = 14;
export const MEMO_PREFIX = "nimday:";

export function generateShortId(): string {
  const bytes = randomBytes(SHORT_ID_LENGTH);
  let out = "";
  for (let i = 0; i < SHORT_ID_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function memoFor(shortId: string): string {
  return MEMO_PREFIX + shortId;
}

/** Extract the shortId from a decoded memo string, or null if it isn't ours. */
export function shortIdFromMemo(memo: string): string | null {
  if (!memo.startsWith(MEMO_PREFIX)) return null;
  const id = memo.slice(MEMO_PREFIX.length).trim();
  return /^[a-z0-9]{6,32}$/.test(id) ? id : null;
}

/** Bytes a memo occupies on-chain (UTF-8). */
export function memoByteLength(memo: string): number {
  return Buffer.byteLength(memo, "utf8");
}
