import { createHash } from "node:crypto";
import { route, ok, forbidden } from "@/lib/http";
import { env } from "@/lib/env";
import {
  createAuthNonce,
  findAuthNonce,
  consumeAuthNonce,
} from "@/lib/auth/nonce";
import { verifyChallenge } from "@/lib/nimiq/challenge";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * DEV ONLY — lets you exercise the full creator flow without a Nimiq Pay device.
 * Disabled in production and unless ALLOW_DEV_LOGIN=1. It does NOT bypass the
 * crypto: it derives a deterministic Nimiq keypair, signs the real challenge,
 * and runs the exact same verifyChallenge + nonce-consume + session path.
 */
export const POST = route(async () => {
  if (env.isProd || process.env.ALLOW_DEV_LOGIN !== "1") {
    return forbidden("Dev login is disabled");
  }

  const Nimiq = await import("@nimiq/core");
  const seed = createHash("sha256")
    .update(`nimday-dev-wallet:${env.authSecret()}`)
    .digest();
  const keyPair = Nimiq.KeyPair.derive(new Nimiq.PrivateKey(new Uint8Array(seed)));
  const address = keyPair.toAddress().toUserFriendlyAddress();

  const { nonce, message } = await createAuthNonce(address);
  const signature = keyPair.sign(new TextEncoder().encode(message));

  const stored = await findAuthNonce(nonce);
  const result = await verifyChallenge(
    {
      nonce,
      address,
      publicKey: keyPair.publicKey.toHex(),
      signature: signature.toHex(),
    },
    stored,
  );
  if (!result.ok) return forbidden(`Dev login failed: ${result.reason}`);
  await consumeAuthNonce(nonce);

  const user = await prisma.user.upsert({
    where: { walletAddress: result.address },
    update: {},
    create: { walletAddress: result.address },
  });
  await createSession({ userId: user.id, walletAddress: user.walletAddress });

  return ok({ user: { walletAddress: user.walletAddress }, dev: true });
});
