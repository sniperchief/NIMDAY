import "server-only";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound } from "@/lib/http";
import { lunaToNimString } from "@/lib/money";
import { normalizeAddress } from "@/lib/nimiq/address";
import {
  checkBody,
  checkSenderName,
  displayName,
  MESSAGE_PROBLEM_COPY,
  normalizeBody,
  normalizeSenderName,
} from "@/lib/messages/text";

export const MESSAGE_PAGE_SIZE = 50;

export interface PublicMessage {
  id: string;
  body: string;
  /** already resolved for display — "Someone" when anonymous, never an address */
  author: string;
  anonymous: boolean;
  createdAt: string;
  /** only present when the message follows a confirmed, non-anonymous gift */
  gift: { amountNim: string; wishTitle: string } | null;
}

export interface CreateMessageInput {
  slug: string;
  body: string;
  senderName?: string | null;
  anonymous: boolean;
  /** wallet address, if the visitor happened to have one connected */
  senderAddress?: string | null;
  /** a payment intent of theirs — the gift link is resolved from it server-side */
  intentId?: string | null;
}

function toPublic(m: {
  id: string;
  body: string;
  senderName: string | null;
  anonymous: boolean;
  createdAt: Date;
  gift: { amountLuna: bigint; anonymous: boolean; wish: { title: string } } | null;
}): PublicMessage {
  // Belt-and-braces: an anonymous gift never surfaces through a message, even
  // if one somehow got linked.
  const gift =
    m.gift && !m.gift.anonymous && !m.anonymous
      ? {
          amountNim: lunaToNimString(m.gift.amountLuna),
          wishTitle: m.gift.wish.title,
        }
      : null;

  return {
    id: m.id,
    body: m.body,
    author: displayName(m.anonymous, m.senderName),
    anonymous: m.anonymous,
    createdAt: m.createdAt.toISOString(),
    gift,
  };
}

const MESSAGE_INCLUDE = {
  gift: { include: { wish: { select: { title: true } } } },
} as const;

/** Messages on a published nimDay, newest first. Sender identity never leaves the server. */
export async function listMessages(
  birthdayId: string,
  limit: number = MESSAGE_PAGE_SIZE,
): Promise<PublicMessage[]> {
  const rows = await prisma.message.findMany({
    where: { birthdayId },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, MESSAGE_PAGE_SIZE),
  });
  return rows.map(toPublic);
}

export async function countMessages(birthdayId: string): Promise<number> {
  return prisma.message.count({ where: { birthdayId } });
}

export async function listMessagesBySlug(
  slug: string,
): Promise<{ messages: PublicMessage[]; total: number }> {
  const birthday = await prisma.birthday.findUnique({
    where: { slug },
    select: { id: true, published: true },
  });
  if (!birthday || !birthday.published) throw notFound("That nimDay isn't available");
  const [messages, total] = await Promise.all([
    listMessages(birthday.id),
    countMessages(birthday.id),
  ]);
  return { messages, total };
}

/**
 * Resolve a gift to attach, from a payment intent the visitor just paid.
 *
 * Rules, in order: the intent must exist, belong to *this* nimDay, be confirmed,
 * and have a gift. An **anonymous gift is never linked** — attaching a named
 * message to it would tell the creator exactly who the anonymous giver was.
 */
async function resolveGiftId(
  intentId: string,
  birthdayId: string,
): Promise<string | null> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: intentId },
    include: { gift: true },
  });
  if (!intent || intent.birthdayId !== birthdayId) return null;
  if (intent.status !== "CONFIRMED" || !intent.gift) return null;
  if (intent.gift.status !== "CONFIRMED") return null;
  if (intent.anonymous || intent.gift.anonymous) return null;
  const alreadyLinked = await prisma.message.count({
    where: { giftId: intent.gift.id },
  });
  if (alreadyLinked > 0) return null; // one message badge per gift
  return intent.gift.id;
}

/**
 * Create a birthday message. No authentication — leaving a message must never
 * require a wallet. Throws a Response (400/404) on invalid input.
 */
export async function createMessage(
  input: CreateMessageInput,
): Promise<PublicMessage> {
  const birthday = await prisma.birthday.findUnique({
    where: { slug: input.slug },
    select: { id: true, published: true },
  });
  if (!birthday || !birthday.published) throw notFound("That nimDay isn't available");

  const body = normalizeBody(input.body ?? "");
  const bodyProblem = checkBody(body);
  if (bodyProblem) throw badRequest(MESSAGE_PROBLEM_COPY[bodyProblem]);

  const senderName = input.anonymous
    ? null
    : normalizeSenderName(input.senderName ?? null);
  const nameProblem = checkSenderName(senderName);
  if (nameProblem) throw badRequest(MESSAGE_PROBLEM_COPY[nameProblem]);

  const senderAddress = input.senderAddress
    ? normalizeAddress(input.senderAddress)
    : null;

  const giftId = input.intentId
    ? await resolveGiftId(input.intentId, birthday.id)
    : null;

  const created = await prisma.message.create({
    data: {
      birthdayId: birthday.id,
      body,
      senderName,
      senderAddress,
      anonymous: input.anonymous,
      giftId,
    },
    include: MESSAGE_INCLUDE,
  });

  return toPublic(created);
}

/**
 * Delete a message from a nimDay — creator only.
 *
 * Authorization is resolved entirely from the authenticated user id and the
 * message's own birthday: no creator id, birthday id or slug is taken from the
 * request. A message is a note on someone's card, so its owner is whoever owns
 * the card.
 *
 * Deleting a message touches nothing but the `Message` row. If it carried a
 * gift badge, `Message.giftId` is the only link and it points *at* the gift —
 * the `Gift`, `PaymentIntent`, `ProcessedTransaction` and `Wish.raisedLuna`
 * rows are untouched, so removing a note can never move money or progress.
 * Anonymous senders stay anonymous: nothing about the sender is returned here
 * either.
 */
export async function deleteMessageAsCreator(
  userId: string,
  messageId: string,
): Promise<{ id: string }> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, birthday: { select: { creatorId: true } } },
  });
  if (!message) throw notFound("That message has already gone");
  if (message.birthday.creatorId !== userId) {
    throw forbidden("You can only remove messages from your own nimDay");
  }

  await prisma.message.delete({ where: { id: message.id } });
  return { id: message.id };
}
