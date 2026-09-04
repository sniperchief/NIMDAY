import { z } from "zod";
import { THEME_IDS } from "@/lib/themes";
import {
  MESSAGE_MAX_LENGTH,
  SENDER_NAME_MAX_LENGTH,
} from "@/lib/messages/text";

export const MAX_WISHES = 5;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return false;
    const year = d.getUTCFullYear();
    return year >= 1900 && year <= new Date().getUTCFullYear() + 1;
  }, "Pick a valid date");

/** "YYYY-MM-DD" -> Date at UTC midnight */
export function parseBirthdayDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
/** Date -> "YYYY-MM-DD" (UTC) */
export function formatBirthdayDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const optionalImage = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v),
    "That doesn't look like an image link",
  )
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const wishInputSchema = z.object({
  title: z.string().trim().min(1, "Give the wish a name").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")).transform((v) => v || undefined),
  imageUrl: optionalImage,
  targetAmount: z
    .number({ invalid_type_error: "Enter an amount" })
    .finite()
    .positive("Amount must be more than 0")
    .max(1_000_000_000, "That target is too large"),
  currency: z
    .enum(["NIM", "USDT"])
    .refine((c) => c === "NIM", "USDT isn't available yet — choose NIM"),
  giftType: z.enum(["FUND", "BUY", "EITHER"]),
});
export type WishInput = z.infer<typeof wishInputSchema>;

export const birthdayDetailsSchema = z.object({
  name: z.string().trim().min(1, "Add a name").max(80),
  birthday: isoDate,
  message: z
    .string()
    .trim()
    .max(280, "Keep the message under 280 characters")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  theme: z.enum(THEME_IDS as [string, ...string[]]),
  imageUrl: optionalImage,
});
export type BirthdayDetails = z.infer<typeof birthdayDetailsSchema>;

export const createBirthdaySchema = birthdayDetailsSchema.extend({
  wishes: z.array(wishInputSchema).max(MAX_WISHES, `Up to ${MAX_WISHES} wishes`),
});
export type CreateBirthdayInput = z.infer<typeof createBirthdaySchema>;

export const updateBirthdaySchema = birthdayDetailsSchema.partial();

export const nonceRequestSchema = z.object({
  address: z.string().trim().min(4).max(60),
});

export const verifyRequestSchema = z.object({
  nonce: z.string().min(8).max(200),
  publicKey: z.string().regex(/^[0-9a-fA-F]{64}$/, "Bad public key"),
  signature: z.string().regex(/^[0-9a-fA-F]{128}$/, "Bad signature"),
  address: z.string().trim().min(4).max(60),
});

/* ---- Phase 2: gifting ---- */

const nimAddress = z.string().trim().min(4).max(60);

export const createIntentSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  wishId: z.string().trim().min(1).max(40),
  amountNim: z
    .string()
    .trim()
    .min(1, "Enter an amount")
    .max(24)
    .regex(/^\d+(\.\d+)?$/, "Enter a valid NIM amount"),
  anonymous: z.boolean().default(false),
  senderAddress: nimAddress.optional(),
});
export type CreateIntentRequest = z.infer<typeof createIntentSchema>;

export const submitTxSchema = z.object({
  txHash: z
    .string()
    .trim()
    .regex(/^(0x)?[0-9a-fA-F]{64}$/, "That doesn't look like a transaction hash")
    .transform((h) => h.replace(/^0x/i, "").toLowerCase()),
  senderAddress: nimAddress.optional(),
});

/* ---- Phase 3: birthday messages ---- */

/**
 * Shape-only validation. The real content rules (normalisation, length,
 * link rejection) live in `messages/text.ts` and run server-side in
 * `createMessage`, so the API and the composer can never drift apart.
 */
export const createMessageSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  body: z.string().min(1, "Write a short birthday message first").max(2000),
  senderName: z.string().max(SENDER_NAME_MAX_LENGTH * 4).optional(),
  anonymous: z.boolean().default(false),
  senderAddress: nimAddress.optional(),
  /** a payment intent the visitor just paid, to link the gift */
  intentId: z.string().trim().min(1).max(40).optional(),
});
export type CreateMessageRequest = z.infer<typeof createMessageSchema>;

export const MESSAGE_LIMITS = {
  body: MESSAGE_MAX_LENGTH,
  senderName: SENDER_NAME_MAX_LENGTH,
} as const;
