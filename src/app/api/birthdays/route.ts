import { route, readJson, ok, unauthorized, conflict } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createBirthdaySchema, parseBirthdayDate } from "@/lib/validation";
import { generateUniqueSlug } from "@/lib/slug";
import { prisma } from "@/lib/prisma";
import { toEditorBirthday } from "@/lib/birthday";

export const POST = route(async (req) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const input = await readJson(req, createBirthdaySchema);

  const existing = await prisma.birthday.findUnique({
    where: { creatorId: user.id },
  });
  if (existing) {
    return conflict("You already have a nimDay", {
      id: existing.id,
      slug: existing.slug,
    });
  }

  const slug = await generateUniqueSlug(
    input.name,
    async (s) => (await prisma.birthday.count({ where: { slug: s } })) > 0,
  );

  const birthday = await prisma.birthday.create({
    data: {
      creatorId: user.id,
      slug,
      name: input.name,
      birthday: parseBirthdayDate(input.birthday),
      message: input.message ?? null,
      theme: input.theme,
      imageUrl: input.imageUrl ?? null,
      wishes: {
        create: input.wishes.map((w, i) => ({
          title: w.title,
          description: w.description ?? null,
          imageUrl: w.imageUrl ?? null,
          targetAmount: w.targetAmount,
          currency: w.currency,
          sortOrder: i,
        })),
      },
    },
    include: { wishes: true },
  });

  return ok({ birthday: toEditorBirthday(birthday) }, { status: 201 });
});
