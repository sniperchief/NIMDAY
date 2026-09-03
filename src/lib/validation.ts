import { z } from "zod";
import { THEME_IDS } from "@/lib/themes";

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
