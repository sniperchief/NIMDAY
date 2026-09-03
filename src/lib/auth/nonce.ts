import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { buildChallengeMessage, type StoredNonce } from "@/lib/nimiq/challenge";

/** Create a fresh challenge nonce for `address` and persist it. */
export async function createAuthNonce(address: string): Promise<{
  nonce: string;
  message: string;
  expiresAt: Date;
}> {
  // opportunistic cleanup of stale nonces
  await prisma.authNonce
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);

  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + env.authNonceTtlSeconds() * 1000);

  await prisma.authNonce.create({
    data: { value: nonce, address, expiresAt },
  });

  return { nonce, message: buildChallengeMessage(nonce), expiresAt };
}

export async function findAuthNonce(value: string): Promise<StoredNonce | null> {
  const row = await prisma.authNonce.findUnique({ where: { value } });
  if (!row) return null;
  return {
    value: row.value,
    address: row.address,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
  };
}

/**
 * Atomically consume a nonce. Returns true only for the first caller — this is
 * the real replay guard (verifyChallenge's `usedAt` check is just for messaging).
 */
export async function consumeAuthNonce(value: string): Promise<boolean> {
  const res = await prisma.authNonce.updateMany({
    where: { value, usedAt: null },
    data: { usedAt: new Date() },
  });
  return res.count === 1;
}
