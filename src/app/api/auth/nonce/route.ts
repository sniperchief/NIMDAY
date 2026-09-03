import { route, readJson, ok } from "@/lib/http";
import { nonceRequestSchema } from "@/lib/validation";
import { normalizeAddress } from "@/lib/nimiq/verifySignature";
import { createAuthNonce } from "@/lib/auth/nonce";

export const POST = route(async (req) => {
  const { address } = await readJson(req, nonceRequestSchema);
  const normalized = normalizeAddress(address) ?? address.trim();
  const { nonce, message, expiresAt } = await createAuthNonce(normalized);
  return ok({ nonce, message, expiresAt: expiresAt.toISOString() });
});
