import { route, readJson, ok, unauthorized } from "@/lib/http";
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
      ...(input.giftType !== undefined ? { giftType: input.giftType } : {}),
    },
  });

  return ok({ birthday: await reloadEditor(wish.birthdayId) });
});

export const DELETE = route(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const wish = await requireOwnedWish(user.id, id);
  await prisma.wish.delete({ where: { id } });
  return ok({ birthday: await reloadEditor(wish.birthdayId) });
});
