import "server-only";
import type { Birthday, Wish } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/http";
import { getBirthdayCountdown, type Countdown } from "@/lib/countdown";
import { formatBirthdayDate } from "@/lib/validation";
import { getTheme } from "@/lib/themes";

export type BirthdayWithWishes = Birthday & { wishes: Wish[] };

export interface EditorWish {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  targetAmount: string;
  currency: "NIM" | "USDT";
  giftType: "FUND" | "BUY" | "EITHER";
  sortOrder: number;
}

export interface EditorBirthday {
  id: string;
  slug: string;
  name: string;
  birthday: string; // YYYY-MM-DD
  message: string | null;
  theme: string;
  imageUrl: string | null;
  published: boolean;
  publishedAt: string | null;
  wishes: EditorWish[];
}

export interface PublicBirthday {
  slug: string;
  name: string;
  birthday: string;
  message: string | null;
  theme: string;
  imageUrl: string | null;
  wishes: Omit<EditorWish, "sortOrder">[];
  countdown: {
    isToday: boolean;
    daysUntil: number;
    nextDateISO: string;
    turningAge: number | null;
  };
}

function wishToEditor(w: Wish): EditorWish {
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    imageUrl: w.imageUrl,
    targetAmount: w.targetAmount.toString(),
    currency: w.currency,
    giftType: w.giftType,
    sortOrder: w.sortOrder,
  };
}

export function toEditorBirthday(b: BirthdayWithWishes): EditorBirthday {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    birthday: formatBirthdayDate(b.birthday),
    message: b.message,
    theme: getTheme(b.theme).id,
    imageUrl: b.imageUrl,
    published: b.published,
    publishedAt: b.publishedAt ? b.publishedAt.toISOString() : null,
    wishes: [...b.wishes]
      .sort((a, c) => a.sortOrder - c.sortOrder)
      .map(wishToEditor),
  };
}

export function toPublicBirthday(
  b: BirthdayWithWishes,
  now: Date = new Date(),
): PublicBirthday {
  const c: Countdown = getBirthdayCountdown(b.birthday, now);
  return {
    slug: b.slug,
    name: b.name,
    birthday: formatBirthdayDate(b.birthday),
    message: b.message,
    theme: getTheme(b.theme).id,
    imageUrl: b.imageUrl,
    wishes: [...b.wishes]
      .sort((a, d) => a.sortOrder - d.sortOrder)
      .map((w) => {
        const { sortOrder: _sortOrder, ...rest } = wishToEditor(w);
        void _sortOrder;
        return rest;
      }),
    countdown: {
      isToday: c.isToday,
      daysUntil: c.daysUntil,
      nextDateISO: c.nextDate.toISOString(),
      turningAge: c.turningAge,
    },
  };
}

export async function getOwnBirthday(
  userId: string,
): Promise<BirthdayWithWishes | null> {
  return prisma.birthday.findUnique({
    where: { creatorId: userId },
    include: { wishes: true },
  });
}

export async function getPublishedBirthdayBySlug(
  slug: string,
): Promise<BirthdayWithWishes | null> {
  const b = await prisma.birthday.findUnique({
    where: { slug },
    include: { wishes: true },
  });
  if (!b || !b.published) return null;
  return b;
}

/**
 * Load a birthday and assert the current user owns it. Throws a Response
 * (404 if missing, 403 if not the creator) — `route()` turns it into JSON.
 */
export async function requireOwnedBirthday(
  userId: string,
  birthdayId: string,
): Promise<BirthdayWithWishes> {
  const b = await prisma.birthday.findUnique({
    where: { id: birthdayId },
    include: { wishes: true },
  });
  if (!b) throw notFound("That NIMday doesn't exist");
  if (b.creatorId !== userId) throw forbidden();
  return b;
}

export async function requireOwnedWish(
  userId: string,
  wishId: string,
): Promise<Wish & { birthday: Birthday }> {
  const w = await prisma.wish.findUnique({
    where: { id: wishId },
    include: { birthday: true },
  });
  if (!w) throw notFound("That wish doesn't exist");
  if (w.birthday.creatorId !== userId) throw forbidden();
  return w;
}

/** Reload a birthday and serialise it for the creator editor. */
export async function reloadEditor(birthdayId: string): Promise<EditorBirthday> {
  const b = await prisma.birthday.findUniqueOrThrow({
    where: { id: birthdayId },
    include: { wishes: true },
  });
  return toEditorBirthday(b);
}

/** Returns a list of human-readable reasons a birthday can't be published yet. */
export function publishProblems(b: BirthdayWithWishes): string[] {
  const problems: string[] = [];
  if (!b.name.trim()) problems.push("Add the birthday person's name");
  if (!b.birthday) problems.push("Add the birthday date");
  if (b.wishes.length > 5) problems.push("You can have at most 5 wishes");
  for (const w of b.wishes) {
    if (!w.title.trim()) problems.push("Every wish needs a title");
    if (Number(w.targetAmount) <= 0)
      problems.push(`"${w.title || "A wish"}" needs a target above 0`);
    if (w.currency !== "NIM")
      problems.push(`"${w.title}" uses an unsupported currency`);
  }
  return [...new Set(problems)];
}
