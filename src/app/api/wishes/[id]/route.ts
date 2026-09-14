import { route, readJson, ok, unauthorized, conflict } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { wishInputSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { requireOwnedWish, reloadEditor } from "@/lib/birthday";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const wish = await requireOwnedWish(user.id, id);

  const input = await readJson(req, wishInputSchema.partial());
  await prisma.wish.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...("description" in input
        ? { description: input.description ?? null }
        : {}),
      ...("imageUrl" in input ? { imageUrl: input.imageUrl ?? null } : {}),
      ...(input.targetAmount !== undefined
        ? { targetAmount: input.targetAmount }
        : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    },
  });

  return ok({ birthday: await reloadEditor(wish.birthdayId) });
});

/**
 * Delete a wish — but never one that has already received a gift.
 *
 * `Gift.wishId` and `PaymentIntent.wishId` cascade from `Wish`, so deleting a
 * gifted wish would erase rows from the verified gift ledger: totals would
 * shrink, activity would lose the gift, and the ProcessedTransaction guard
 * would be left pointing at a gift that no longer exists. The ledger is the
 * authoritative record of money that really moved, so it outranks tidying up
 * a wishlist. The creator can still rename or re-target the wish.
 */
export const DELETE = route(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const wish = await requireOwnedWish(user.id, id);

  const gifts = await prisma.gift.count({ where: { wishId: id } });
  if (gifts > 0) {
    return conflict(
      `"${wish.title}" has already received a gift, so it can't be removed. ` +
        "You can rename it or change its target instead.",
      { wishId: id, giftCount: gifts },
    );
  }

  await prisma.wish.delete({ where: { id } });
  return ok({ birthday: await reloadEditor(wish.birthdayId) });
});
