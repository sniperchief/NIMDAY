import { route, ok, notFound } from "@/lib/http";
import { getPaymentStatus } from "@/lib/gifts/intent";

type Ctx = { params: Promise<{ id: string }> };

/** Poll a payment's status (used by the gift UI while verification runs). */
export const GET = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const status = await getPaymentStatus(id);
  if (!status) return notFound("That gift wasn't found");
  return ok({ payment: status });
});
