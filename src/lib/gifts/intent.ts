import "server-only";
import type { PaymentIntent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/http";
import { nimStringToLuna } from "@/lib/money";
import { lunaToNimString } from "@/lib/money";
import { generateShortId, memoFor } from "@/lib/gifts/shortId";
import { normalizeAddress } from "@/lib/nimiq/address";
import { giftDeepLink } from "@/lib/nimiq/deepLink";
import { env } from "@/lib/env";

export const INTENT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface CreateIntentInput {
  slug: string;
  wishId: string;
  amountNim: string;
  anonymous: boolean;
  senderAddress?: string | null;
}

export interface PaymentIntentView {
  id: string;
  shortId: string;
  memo: string;
  recipientAddress: string;
  amountLuna: string;
  amountNim: string;
  currency: "NIM";
  anonymous: boolean;
  status: PaymentIntent["status"];
  expiresAt: string;
  birthdayName: string;
  birthdaySlug: string;
  wishId: string;
  wishTitle: string;
  deepLink: string;
  /** true when nimDay is pointed at test NIM — the UI says so, loudly */
  testnet: boolean;
}

export interface PaymentStatusView {
  id: string;
  status: PaymentIntent["status"];
  amountNim: string;
  currency: "NIM";
  anonymous: boolean;
  wishId: string;
  wishTitle: string;
  birthdayName: string;
  birthdaySlug: string;
  txHash: string | null;
  failureReason: string | null;
  confirmedGift: { amountNim: string; confirmedAt: string } | null;
  /** true when nimDay is pointed at test NIM — the UI says so, loudly */
  testnet: boolean;
  /** present only while the intent is still payable — the data needed to send */
  payContext: {
    recipientAddress: string;
    memo: string;
    amountLuna: string;
    expiresAt: string;
  } | null;
}

/**
 * Create a payment intent. Throws a Response (400/404) on invalid input.
 * The recipient address is ALWAYS derived from the wish's birthday's creator —
 * never taken from the client.
 */
export async function createPaymentIntent(
  input: CreateIntentInput,
): Promise<PaymentIntentView> {
  const birthday = await prisma.birthday.findUnique({
    where: { slug: input.slug },
    include: { creator: true, wishes: true },
  });
  if (!birthday || !birthday.published) {
    throw notFound("That nimDay isn't available");
  }

  const wish = birthday.wishes.find((w) => w.id === input.wishId);
  if (!wish) throw notFound("That wish doesn't exist");
  if (wish.currency !== "NIM") {
    throw badRequest("Only NIM gifts are supported right now");
  }

  const recipientAddress = normalizeAddress(birthday.creator.walletAddress);
  if (!recipientAddress) {
    throw badRequest("This nimDay can't receive gifts yet");
  }

  let amountLuna: bigint;
  try {
    amountLuna = nimStringToLuna(input.amountNim);
  } catch (err) {
    throw badRequest(err instanceof Error ? err.message : "Enter a valid amount");
  }

  const senderAddress = input.senderAddress
    ? normalizeAddress(input.senderAddress)
    : null;

  // Ensure a unique shortId (collision odds are negligible; loop is belt-and-braces).
  let shortId = generateShortId();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.paymentIntent.count({ where: { shortId } });
    if (clash === 0) break;
    shortId = generateShortId();
  }

  const intent = await prisma.paymentIntent.create({
    data: {
      birthdayId: birthday.id,
      wishId: wish.id,
      recipientAddress,
      currency: "NIM",
      expectedAmountLuna: amountLuna,
      minAmountLuna: amountLuna,
      shortId,
      memo: memoFor(shortId),
      anonymous: input.anonymous,
      senderAddress,
      status: "CREATED",
      expiresAt: new Date(Date.now() + INTENT_TTL_MS),
    },
  });

  return {
    id: intent.id,
    shortId: intent.shortId,
    memo: intent.memo,
    recipientAddress: intent.recipientAddress,
    amountLuna: intent.expectedAmountLuna.toString(),
    amountNim: lunaToNimString(intent.expectedAmountLuna),
    currency: "NIM",
    anonymous: intent.anonymous,
    status: intent.status,
    expiresAt: intent.expiresAt.toISOString(),
    birthdayName: birthday.name,
    birthdaySlug: birthday.slug,
    wishId: wish.id,
    wishTitle: wish.title,
    deepLink: giftDeepLink(env.appOrigin, birthday.slug, { intentId: intent.id }),
    testnet: env.isTestnet(),
  };
}

export async function getPaymentStatus(
  id: string,
): Promise<PaymentStatusView | null> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id },
    include: {
      wish: true,
      birthday: true,
      gift: true,
    },
  });
  if (!intent) return null;

  const payable = ["CREATED", "SUBMITTED", "PENDING"].includes(intent.status);

  return {
    id: intent.id,
    status: intent.status,
    amountNim: lunaToNimString(intent.expectedAmountLuna),
    currency: "NIM",
    anonymous: intent.anonymous,
    wishId: intent.wishId,
    wishTitle: intent.wish.title,
    birthdayName: intent.birthday.name,
    birthdaySlug: intent.birthday.slug,
    txHash: intent.txHash,
    failureReason: intent.failureReason,
    confirmedGift:
      intent.gift && intent.gift.status === "CONFIRMED"
        ? {
            amountNim: lunaToNimString(intent.gift.amountLuna),
            confirmedAt: intent.gift.confirmedAt.toISOString(),
          }
        : null,
    testnet: env.isTestnet(),
    payContext: payable
      ? {
          recipientAddress: intent.recipientAddress,
          memo: intent.memo,
          amountLuna: intent.expectedAmountLuna.toString(),
          expiresAt: intent.expiresAt.toISOString(),
        }
      : null,
  };
}

/** For the giver-facing "submit tx hash" step. */
export async function attachTransaction(
  id: string,
  txHash: string,
  senderAddress: string | null,
): Promise<PaymentStatusView> {
  const intent = await prisma.paymentIntent.findUnique({ where: { id } });
  if (!intent) throw notFound("That gift wasn't found");
  if (intent.expiresAt.getTime() < Date.now() && intent.status === "CREATED") {
    await prisma.paymentIntent.update({
      where: { id },
      data: { status: "EXPIRED" },
    });
    throw badRequest("This gift request has expired — start again");
  }
  if (["CONFIRMED", "FAILED", "EXPIRED"].includes(intent.status)) {
    const view = await getPaymentStatus(id);
    return view!;
  }

  const cleanSender = senderAddress ? normalizeAddress(senderAddress) : null;

  await prisma.paymentIntent.update({
    where: { id },
    data: {
      txHash,
      status: "SUBMITTED",
      senderAddress: intent.senderAddress ?? cleanSender,
    },
  });

  const view = await getPaymentStatus(id);
  return view!;
}
