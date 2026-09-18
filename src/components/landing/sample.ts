import type { BirthdayCardData } from "@/components/BirthdayCard";
import type { WishCardData } from "@/components/WishList";
import type { PublicMessage } from "@/lib/apiClient";

/**
 * Demonstration data for the homepage only. None of this is stored anywhere or
 * reachable from a real nimDay — it just feeds the real card, wishlist and
 * message components so visitors can see the product without signing in.
 */

/**
 * A birthday about a month away (and a plausible birth year), so the sample's
 * date tile always shows an upcoming date whenever the page was built.
 */
function sampleBirthdayISO() {
  const next = new Date();
  next.setUTCMonth(next.getUTCMonth() + 1);
  const born = new Date(
    Date.UTC(next.getUTCFullYear() - 30, next.getUTCMonth(), next.getUTCDate()),
  );
  return born.toISOString().slice(0, 10);
}

/**
 * The next 30th of a month (every month but February has one), with a birth
 * year that makes it a 30th birthday — the showcase card always shows an
 * upcoming date.
 */
function showcaseBirthdayISO() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 30));
  while (next.getUTCDate() !== 30 || next.getTime() <= now.getTime()) {
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(30);
  }
  return `${next.getUTCFullYear() - 30}${next.toISOString().slice(4, 10)}`;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

export const SAMPLE: BirthdayCardData = {
  name: "Sarah",
  birthday: sampleBirthdayISO(),
  message: null,
  theme: "confetti",
  // Pexels photo, cropped to a 384px square and compressed (~20 KB). The
  // original stays out of the repo.
  imageUrl: "/sample/sarah.jpg",
};

/** The "See a nimDay" showcase card. */
export const SAMPLE_SHOWCASE: BirthdayCardData = {
  name: "Andrew",
  birthday: showcaseBirthdayISO(),
  theme: "confetti",
  // Cropped to a 384px square and compressed, like the other samples.
  imageUrl: "/sample/andrew.jpg",
  message: "Turning 30! A few things I've had my eye on 🎉",
};

const HEADPHONES: WishCardData = {
  id: "s1",
  title: "New headphones",
  description: "The over-ear ones I keep talking about",
  imageUrl: "/sample/headphones.jpg",
  targetNim: "120",
  currency: "NIM",
  raisedNim: "85",
  progressPct: 71,
  fulfilled: false,
};

const PHONE: WishCardData = {
  id: "s2",
  title: "iPhone 18",
  description: null,
  imageUrl: "/sample/iphone-18.jpg",
  targetNim: "60",
  currency: "NIM",
  raisedNim: "60",
  progressPct: 100,
  fulfilled: true,
};

const AIRPODS: WishCardData = {
  id: "s3",
  title: "AirPods",
  description: "For the gym and the commute",
  imageUrl: "/sample/airpods.jpg",
  targetNim: "200",
  currency: "NIM",
  raisedNim: "0",
  progressPct: 0,
  fulfilled: false,
};

/** The hero card: one wish in progress, one fulfilled. */
export const SAMPLE_WISHES: WishCardData[] = [HEADPHONES, PHONE];

/** The wishlist section: a fresh wish, one in progress, one fulfilled. */
export const SAMPLE_WISHLIST: WishCardData[] = [AIRPODS, HEADPHONES, PHONE];

/**
 * The showcase card's own wishes. Descriptions are left off to keep the card
 * short.
 */
export const SAMPLE_SHOWCASE_WISHES: WishCardData[] = [
  { ...AIRPODS, description: null },
  {
    id: "s4",
    title: "Leather messenger bag",
    description: null,
    imageUrl: "/sample/leather-bag.jpg",
    targetNim: "150",
    currency: "NIM",
    raisedNim: "95",
    progressPct: 63,
    fulfilled: false,
  },
  {
    id: "s5",
    title: "Tom Ford Ombré Leather",
    description: null,
    imageUrl: "/sample/perfume.jpg",
    targetNim: "80",
    currency: "NIM",
    raisedNim: "80",
    progressPct: 100,
    fulfilled: true,
  },
];

/** The gifting section: the same wish before and after a 35 NIM gift. */
export const SAMPLE_GIFT_BEFORE: WishCardData = HEADPHONES;
export const SAMPLE_GIFT_AFTER: WishCardData = {
  ...HEADPHONES,
  id: "s1-after",
  raisedNim: "120",
  progressPct: 100,
  fulfilled: true,
};

/**
 * One message of each kind, attributed exactly the way the message store
 * resolves them: a name, "A friend" when no name is given, "Someone" when
 * anonymous, and a gift tag only on a confirmed, non-anonymous gift.
 */
export const SAMPLE_MESSAGES: Record<
  "named" | "friend" | "anonymous" | "gift",
  PublicMessage
> = {
  gift: {
    id: "m1",
    body: "Happy 30th! Put this toward the headphones — you deserve to hear everything in glorious detail 🎧",
    author: "Maya",
    anonymous: false,
    createdAt: hoursAgo(2),
    gift: { amountNim: "35", wishTitle: "New headphones" },
  },
  named: {
    id: "m2",
    body: "Happy birthday Andrew! Can't wait to celebrate with you on Saturday 🎉",
    author: "Leo",
    anonymous: false,
    createdAt: hoursAgo(5),
    gift: null,
  },
  friend: {
    id: "m3",
    body: "Wishing you the best year yet!",
    author: "A friend",
    anonymous: false,
    createdAt: hoursAgo(20),
    gift: null,
  },
  anonymous: {
    id: "m4",
    body: "You make every room brighter. Happy birthday ✨",
    author: "Someone",
    anonymous: true,
    createdAt: hoursAgo(26),
    gift: null,
  },
};

/** Messages under the showcase card, matching its wishes. */
export const SAMPLE_SHOWCASE_MESSAGES: PublicMessage[] = [
  {
    ...SAMPLE_MESSAGES.gift,
    body: "Happy 30th! Put this toward the bag — you've earned an upgrade 🎁",
    gift: { amountNim: "35", wishTitle: "Leather messenger bag" },
  },
  SAMPLE_MESSAGES.named,
];
