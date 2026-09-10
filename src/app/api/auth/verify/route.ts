import { route, readJson, ok, fail } from "@/lib/http";
import { verifyRequestSchema } from "@/lib/validation";
import {
  verifyChallenge,
  buildChallengeMessage,
  type ChallengeFailure,
} from "@/lib/nimiq/challenge";
import { findAuthNonce, consumeAuthNonce } from "@/lib/auth/nonce";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const MESSAGES: Record<ChallengeFailure, string> = {
  malformed: "That sign-in request looked malformed. Please try again.",
  nonce_not_found: "This sign-in request has expired. Please start again.",
  nonce_expired: "This sign-in request has expired. Please start again.",
  nonce_used: "That sign-in request was already used. Please start again.",
  bad_signature: "We couldn't verify that signature. Please try again.",
  address_mismatch: "The signature didn't match your wallet address.",
};

export const POST = route(async (req) => {
  const body = await readJson(req, verifyRequestSchema);

  const stored = await findAuthNonce(body.nonce);
  const result = await verifyChallenge(body, stored);
  if (!result.ok) {
    if (result.reason === "bad_signature") {
      // The exact bytes Nimiq Pay signs are still unconfirmed, so record what
      // the device actually sent when none of the candidate encodings match.
      // A public key, a signature and a single-use public challenge are all
      // public values — nothing secret is written here.
      console.error("[auth] signature did not match any known encoding", {
        message: buildChallengeMessage(body.nonce),
        publicKey: body.publicKey,
        signature: body.signature,
        claimedAddress: body.address,
      });
    }
    return fail(401, "auth_failed", MESSAGES[result.reason]);
  }

  // Atomic replay guard — only the first caller wins.
  const consumed = await consumeAuthNonce(body.nonce);
  if (!consumed) {
    return fail(401, "auth_failed", MESSAGES.nonce_used);
  }

  const user = await prisma.user.upsert({
    where: { walletAddress: result.address },
    update: {},
    create: { walletAddress: result.address },
  });

  await createSession({ userId: user.id, walletAddress: user.walletAddress });

  return ok({
    user: { walletAddress: user.walletAddress },
    // Surface which encoding verified — useful telemetry until the device check lands.
    signatureEncoding: result.encoding,
  });
});
