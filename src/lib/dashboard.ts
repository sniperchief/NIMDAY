import "server-only";
import { prisma } from "@/lib/prisma";
import { LUNA_PER_NIM, lunaToNimString } from "@/lib/money";
import { maskAddress } from "@/lib/nimiq/address";
import { getBirthdayCountdown } from "@/lib/countdown";
import { formatBirthdayDate } from "@/lib/validation";
import { publicBirthdayUrl } from "@/lib/share";
import { excerpt, type ActivityItem } from "@/lib/activityText";
import { listMessages, type PublicMessage } from "@/lib/messages/store";
import { env } from "@/lib/env";

export interface DashboardWish {
  id: string;
  title: string;
  targetNim: string;
  raisedNim: string;
  progressPct: number;
  fulfilled: boolean;
}

export interface CreatorDashboard {
  overview: {
    id: string;
    name: string;
    /** YYYY-MM-DD */
    birthday: string;
    theme: string;
    imageUrl: string | null;
    published: boolean;
    publishedAt: string | null;
    slug: string;
    /** the one canonical public link */
    url: string;
    countdown: {
      isToday: boolean;
      daysUntil: number;
      turningAge: number | null;
    };
    /** NIMday is pointed at test NIM — the dashboard says so rather than
     *  letting a creator believe test gifts were real. */
    testnet: boolean;
  };
  summary: {
    giftCount: number;
    totalNim: string;
    messageCount: number;
    wishCount: number;
    wishesFulfilled: number;
    wishes: DashboardWish[];
  };
  activity: ActivityItem[];
  /**
   * The messages on this NIMday, in exactly the shape the public page gets —
   * so the creator's own view can never reveal more about a sender than a
   * visitor sees. Listed here so the creator can remove one.
   */
  messages: PublicMessage[];
}

/** NIM (Decimal, 5 dp) -> Luna, with integer maths only. */
function targetToLuna(target: { toString(): string }): bigint {
  const [whole, frac = ""] = target.toString().split(".");
  return (
    BigInt(whole) * LUNA_PER_NIM + BigInt(frac.padEnd(5, "0").slice(0, 5) || "0")
  );
}

const ACTIVITY_LIMIT = 30;

/**
 * Everything the "My NIMday" page shows, for one creator's own NIMday.
 *
 * There is no second source of truth for money here: gift totals and wish
 * progress come from the Phase 2 gift ledger (`Gift` rows with status
 * CONFIRMED) exactly as the public page does.
 */
export async function getCreatorDashboard(
  userId: string,
  now: Date = new Date(),
): Promise<CreatorDashboard | null> {
  const birthday = await prisma.birthday.findUnique({
    where: { creatorId: userId },
    include: {
      wishes: { orderBy: { sortOrder: "asc" } },
      gifts: { include: { wish: { select: { title: true } } }, orderBy: { confirmedAt: "asc" } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
      },
    },
  });
  if (!birthday) return null;

  const confirmedGifts = birthday.gifts.filter((g) => g.status === "CONFIRMED");
  const totalLuna = confirmedGifts.reduce((sum, g) => sum + g.amountLuna, 0n);

  const wishes: DashboardWish[] = birthday.wishes.map((w) => {
    const targetLuna = targetToLuna(w.targetAmount);
    const raisedLuna = BigInt(w.raisedLuna ?? 0);
    return {
      id: w.id,
      title: w.title,
      targetNim: lunaToNimString(targetLuna),
      raisedNim: lunaToNimString(raisedLuna),
      progressPct:
        targetLuna > 0n
          ? Math.min(100, Number((raisedLuna * 10000n) / targetLuna) / 100)
          : 0,
      fulfilled: targetLuna > 0n && raisedLuna >= targetLuna,
    };
  });

  /* --- activity: gifts, messages, and the moment each wish was fulfilled --- */

  const activity: ActivityItem[] = [];

  for (const g of birthday.gifts) {
    activity.push({
      id: `gift:${g.id}`,
      kind: "gift",
      at: g.confirmedAt.toISOString(),
      actor: g.anonymous ? null : maskAddress(g.senderAddress),
      amountNim: lunaToNimString(g.amountLuna),
      wishTitle: g.wish.title,
      reversed: g.status === "REVERSED",
    });
  }

  for (const m of birthday.messages) {
    activity.push({
      id: `message:${m.id}`,
      kind: "message",
      at: m.createdAt.toISOString(),
      actor: m.anonymous ? null : m.senderName,
      excerpt: excerpt(m.body),
    });
  }

  // A wish becomes "fulfilled" at the confirmed gift that first crossed its
  // target — derived by replaying the ledger, so it can't drift from progress.
  for (const w of birthday.wishes) {
    const targetLuna = targetToLuna(w.targetAmount);
    if (targetLuna <= 0n) continue;
    let running = 0n;
    for (const g of confirmedGifts) {
      if (g.wishId !== w.id) continue;
      running += g.amountLuna;
      if (running >= targetLuna) {
        activity.push({
          id: `fulfilled:${w.id}`,
          kind: "fulfilled",
          at: g.confirmedAt.toISOString(),
          actor: null,
          wishTitle: w.title,
        });
        break;
      }
    }
  }

  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const c = getBirthdayCountdown(birthday.birthday, now);

  return {
    overview: {
      id: birthday.id,
      name: birthday.name,
      birthday: formatBirthdayDate(birthday.birthday),
      theme: birthday.theme,
      imageUrl: birthday.imageUrl,
      published: birthday.published,
      publishedAt: birthday.publishedAt?.toISOString() ?? null,
      slug: birthday.slug,
      url: publicBirthdayUrl(env.appOrigin, birthday.slug),
      countdown: {
        isToday: c.isToday,
        daysUntil: c.daysUntil,
        turningAge: c.turningAge,
      },
      testnet: env.isTestnet(),
    },
    summary: {
      giftCount: confirmedGifts.length,
      totalNim: lunaToNimString(totalLuna),
      messageCount: await prisma.message.count({ where: { birthdayId: birthday.id } }),
      wishCount: birthday.wishes.length,
      wishesFulfilled: wishes.filter((w) => w.fulfilled).length,
      wishes,
    },
    activity: activity.slice(0, ACTIVITY_LIMIT),
    messages: await listMessages(birthday.id),
  };
}
