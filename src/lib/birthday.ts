import "server-only";
import type { Birthday, Wish } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/http";
import { getBirthdayCountdown, type Countdown } from "@/lib/countdown";
import { formatBirthdayDate } from "@/lib/validation";
import { getTheme } from "@/lib/themes";
import { LUNA_PER_NIM, lunaToNimString } from "@/lib/money";

/** A wish row, optionally carrying its gift count (loaded for editor views). */
export type WishWithCounts = Wish & { _count?: { gifts: number } };
export type BirthdayWithWishes = Birthday & { wishes: WishWithCounts[] };

/** Include shape for the creator editor — it needs to know which wishes are gifted. */
const EDITOR_INCLUDE = {
  wishes: { include: { _count: { select: { gifts: true } } } },
} as const;

export interface EditorWish {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  targetAmount: string;
  currency: "NIM" | "USDT";
  giftType: "FUND" | "BUY" | "EITHER";
  sortOrder: number;
  /** verified contributions so far, e.g. "45.5" — display only */
  raisedNim: string;
  /** gifts recorded against this wish; > 0 means it can no longer be deleted */
  giftCount: number;
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

export interface PublicWish {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  currency: "NIM" | "USDT";
  giftType: "FUND" | "BUY" | "EITHER";
  targetNim: string; // trimmed, e.g. "120"
  raisedNim: string; // verified contributions only, e.g. "45.5"
  raisedLuna: string;
  /** 0–100, capped */
  progressPct: number;
  fulfilled: boolean;
}

export interface PublicBirthday {
  slug: string;
  name: string;
  birthday: string;
  message: string | null;
  theme: string;
  imageUrl: string | null;
  wishes: PublicWish[];
  countdown: {
    isToday: boolean;
    daysUntil: number;
    nextDateISO: string;
    turningAge: number | null;
  };
}

function wishToPublic(w: Wish): PublicWish {
  // targetAmount is NIM with up to 5 dp; convert to Luna with integer maths.
  const targetStr = w.targetAmount.toString();
  const [whole, frac = ""] = targetStr.split(".");
  const targetLuna =
    BigInt(whole) * LUNA_PER_NIM + BigInt(frac.padEnd(5, "0").slice(0, 5) || "0");
  const raisedLuna = BigInt(w.raisedLuna ?? 0);
  const pct =
    targetLuna > 0n
      ? Math.min(100, Number((raisedLuna * 10000n) / targetLuna) / 100)
      : 0;
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    imageUrl: w.imageUrl,
    currency: w.currency,
    giftType: w.giftType,
    targetNim: lunaToNimString(targetLuna),
    raisedNim: lunaToNimString(raisedLuna),
    raisedLuna: raisedLuna.toString(),
    progressPct: pct,
    fulfilled: targetLuna > 0n && raisedLuna >= targetLuna,
  };
}

function wishToEditor(w: WishWithCounts): EditorWish {
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    imageUrl: w.imageUrl,
    targetAmount: w.targetAmount.toString(),
    currency: w.currency,
    giftType: w.giftType,
    sortOrder: w.sortOrder,
    raisedNim: lunaToNimString(BigInt(w.raisedLuna ?? 0)),
    giftCount: w._count?.gifts ?? 0,
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
      .map(wishToPublic),
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
    include: EDITOR_INCLUDE,
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
    include: EDITOR_INCLUDE,
  });
  if (!b) throw notFound("That nimDay doesn't exist");
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
    include: EDITOR_INCLUDE,
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
