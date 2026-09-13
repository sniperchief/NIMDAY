import { route, readJson, ok, badRequest, fail } from "@/lib/http";
import { createMessageSchema } from "@/lib/validation";
import { createMessage, listMessagesBySlug } from "@/lib/messages/store";
import { normalizeBody } from "@/lib/messages/text";
import { checkRateLimit, clientKey, isDuplicateSubmission } from "@/lib/rateLimit";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/** Messages on a published nimDay. Public — no wallet, no account. */
export const GET = route(async (req) => {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return badRequest("Which nimDay?");
  const { messages, total } = await listMessagesBySlug(slug);
  return ok({ messages, total });
});

/**
 * Leave a birthday message. Deliberately unauthenticated: a visitor must never
 * have to connect a wallet just to say happy birthday. Everything that could be
 * abused is bounded server-side — content rules in `messages/text.ts`, volume
 * here.
 */
export const POST = route(async (req) => {
  const body = await readJson(req, createMessageSchema);

  const key = clientKey(req, `message:${body.slug}`);
  const limit = checkRateLimit(key, { limit: MAX_PER_WINDOW, windowMs: WINDOW_MS });
  if (!limit.allowed) {
    return fail(
      429,
      "rate_limited",
      "That's a lot of birthday cheer! Give it a minute before sending another message.",
      { retryAfterSeconds: limit.retryAfterSeconds },
    );
  }

  const normalized = normalizeBody(body.body);
  if (normalized && isDuplicateSubmission(key, normalized, WINDOW_MS)) {
    return badRequest("You've already left that message");
  }

  const message = await createMessage({
    slug: body.slug,
    body: body.body,
    senderName: body.senderName ?? null,
    anonymous: body.anonymous ?? false,
    senderAddress: body.senderAddress ?? null,
    intentId: body.intentId ?? null,
  });

  return ok({ message }, { status: 201 });
});
