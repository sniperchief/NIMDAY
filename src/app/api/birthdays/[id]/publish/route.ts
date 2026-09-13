import { route, ok, unauthorized, badRequest } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { prisma } from "@/lib/prisma";
import {
  requireOwnedBirthday,
  reloadEditor,
  publishProblems,
} from "@/lib/birthday";
import { env } from "@/lib/env";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const b = await requireOwnedBirthday(user.id, id);
  const problems = publishProblems(b);
  if (problems.length > 0) {
    return badRequest("This nimDay isn't ready to publish yet", { problems });
  }

  await prisma.birthday.update({
    where: { id },
    data: { published: true, publishedAt: b.publishedAt ?? new Date() },
  });

  const birthday = await reloadEditor(id);
  return ok({ birthday, url: `${env.appOrigin}/b/${birthday.slug}` });
});
