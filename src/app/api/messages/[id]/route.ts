import { route, ok, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { deleteMessageAsCreator } from "@/lib/messages/store";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Remove a message from your own nimDay.
 *
 * The only creator operation on messages there is — this is not moderation,
 * it is the birthday person taking a note off their own card. Ownership comes
 * from the session and the message's birthday; the request carries nothing but
 * the message id, so there is no creator id to tamper with.
 */
export const DELETE = route(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const deleted = await deleteMessageAsCreator(user.id, id);
  return ok({ deleted });
});
