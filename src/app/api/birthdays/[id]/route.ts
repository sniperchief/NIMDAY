import { route, readJson, ok, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { updateBirthdaySchema, parseBirthdayDate } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import {
  requireOwnedBirthday,
  reloadEditor,
  toEditorBirthday,
} from "@/lib/birthday";
import type { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const b = await requireOwnedBirthday(user.id, id);
  return ok({ birthday: toEditorBirthday(b) });
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  await requireOwnedBirthday(user.id, id);

  const patch = await readJson(req, updateBirthdaySchema);
  const data: Prisma.BirthdayUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.birthday !== undefined)
    data.birthday = parseBirthdayDate(patch.birthday);
  if ("message" in patch) data.message = patch.message ?? null;
  if (patch.theme !== undefined) data.theme = patch.theme;
  if ("imageUrl" in patch) data.imageUrl = patch.imageUrl ?? null;

  await prisma.birthday.update({ where: { id }, data });
  return ok({ birthday: await reloadEditor(id) });
});
