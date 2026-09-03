import { route, readJson, ok } from "@/lib/http";
import { createIntentSchema } from "@/lib/validation";
import { createPaymentIntent } from "@/lib/gifts/intent";

/**
 * Create a payment intent. No auth — visitors gift without an account. The
 * recipient address is derived server-side from the wish's birthday's creator;
 * nothing about the recipient or amount is trusted from the client beyond the
 * amount the visitor chose to send.
 */
export const POST = route(async (req) => {
  const body = await readJson(req, createIntentSchema);
  const intent = await createPaymentIntent({
    slug: body.slug,
    wishId: body.wishId,
    amountNim: body.amountNim,
    anonymous: body.anonymous ?? false,
    senderAddress: body.senderAddress ?? null,
  });
  return ok({ intent }, { status: 201 });
});
