import { route, readJson, ok, unauthorized, conflict } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { wishInputSchema, MAX_WISHES } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { requireOwnedBirthday, reloadEditor } from "@/lib/birthday";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const b = await requireOwnedBirthday(user.id, id);
  if (b.wishes.length >= MAX_WISHES) {
    return conflict(`You can have at most ${MAX_WISHES} wishes`);
  }

  const input = await readJson(req, wishInputSchema);
  const nextOrder =
    b.wishes.reduce((m, w) => Math.max(m, w.sortOrder), -1) + 1;

  await prisma.wish.create({
    data: {
      birthdayId: id,
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      targetAmount: input.targetAmount,
      currency: input.currency,
      sortOrder: nextOrder,
    },
  });

  return ok({ birthday: await reloadEditor(id) }, { status: 201 });
});
