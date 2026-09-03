import { buildChallengeMessage } from "@/lib/nimiq/challenge";

export interface SignedChallenge {
  publicKey: string;
  signature: string;
  address: string;
}

/** Produce a real Nimiq signature over the challenge for `nonce`. */
export async function signChallenge(
  nonce: string,
  keyPair?: import("@nimiq/core").KeyPair,
): Promise<SignedChallenge & { keyPair: import("@nimiq/core").KeyPair }> {
  const Nimiq = await import("@nimiq/core");
  const kp = keyPair ?? Nimiq.KeyPair.generate();
  const message = buildChallengeMessage(nonce);
  const sig = kp.sign(new TextEncoder().encode(message));
  return {
    keyPair: kp,
    publicKey: kp.publicKey.toHex(),
    signature: sig.toHex(),
    address: kp.toAddress().toUserFriendlyAddress(),
  };
}

export async function newKeyPair() {
  const Nimiq = await import("@nimiq/core");
  return Nimiq.KeyPair.generate();
}
