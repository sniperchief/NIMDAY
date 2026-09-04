/**
 * Pure helpers for birthday messages. No database, no server-only imports —
 * the same rules run in the composer and in the API route, and are unit-tested
 * directly.
 */

export const MESSAGE_MAX_LENGTH = 240;
export const SENDER_NAME_MAX_LENGTH = 32;

export type MessageProblem =
  | "empty"
  | "too_long"
  | "links_not_allowed"
  | "name_too_long";

export const MESSAGE_PROBLEM_COPY: Record<MessageProblem, string> = {
  empty: "Write a short birthday message first",
  too_long: `Keep it under ${MESSAGE_MAX_LENGTH} characters`,
  links_not_allowed: "Links aren't allowed in birthday messages",
  name_too_long: `Keep your name under ${SENDER_NAME_MAX_LENGTH} characters`,
};

/** Control characters other than newline and tab — pasted junk, zero-width tricks. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g;

const LINK_PATTERN =
  /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|xyz|ru|cn|co|me|app|link|top|info|biz|site|online|shop|club)\b)/i;

/**
 * Tidy a message body: strip control characters, normalise whitespace, and
 * collapse runs of blank lines. Length is *not* enforced here — see `checkBody`.
 */
export function normalizeBody(input: string): string {
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeSenderName(input: string | null | undefined): string | null {
  if (!input) return null;
  const clean = input.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
  return clean === "" ? null : clean;
}

/** First problem with a normalised body, or null when it's fine. */
export function checkBody(body: string): MessageProblem | null {
  if (body.length === 0) return "empty";
  if ([...body].length > MESSAGE_MAX_LENGTH) return "too_long";
  if (LINK_PATTERN.test(body)) return "links_not_allowed";
  return null;
}

export function checkSenderName(name: string | null): MessageProblem | null {
  if (name === null) return null;
  if ([...name].length > SENDER_NAME_MAX_LENGTH) return "name_too_long";
  if (LINK_PATTERN.test(name)) return "links_not_allowed";
  return null;
}

/** Characters remaining, counted the way the composer counts them. */
export function remainingCharacters(body: string): number {
  return MESSAGE_MAX_LENGTH - [...body].length;
}

/**
 * How a message is attributed in the UI. Anonymous always wins, and an
 * unnamed visitor becomes "A friend" rather than an empty byline.
 */
export function displayName(
  anonymous: boolean,
  senderName: string | null,
): string {
  if (anonymous) return "Someone";
  return senderName?.trim() || "A friend";
}
