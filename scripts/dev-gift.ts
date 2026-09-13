/**
 * DEV ONLY — simulate a stranger sending a gift, so you can watch wish progress
 * and the creator dashboard update without a phone or real NIM.
 *
 * It creates a real payment intent and then feeds the REAL verification + credit
 * code a synthetic confirmed transaction (exactly what the worker would do).
 *
 *   npm run dev:gift            2 NIM to the newest nimDay's first wish
 *   npm run dev:gift 5          5 NIM
 *   npm run dev:gift 5 anon     5 NIM, anonymous
 *
 * Note: don't add `# comments` after the command on Windows cmd.exe — `#` is not
 * a comment there and gets passed in as the amount.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent } from "@/lib/gifts/intent";
import { applyTransactionToIntent } from "@/lib/gifts/process";
import { EXPECTED_NETWORK, type PlainTxDetails } from "@/lib/gifts/verification";
import { lunaToNimString, nimStringToLuna } from "@/lib/money";

const USAGE = "usage: npm run dev:gift [amountNim] [anon]   e.g. npm run dev:gift 5 anon";

function die(message: string): never {
  console.error(`\n✖ ${message}\n  ${USAGE}\n`);
  process.exit(1);
}

/** Server helpers throw NextResponse objects for the route layer; unwrap them here. */
async function readThrown(err: unknown): Promise<string> {
  if (err instanceof Response) {
    try {
      const body = (await err.json()) as { error?: { message?: string } };
      return body?.error?.message ?? `request failed (${err.status})`;
    } catch {
      return `request failed (${err.status})`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

const rawAmount = process.argv[2] ?? "2";
const rawFlag = process.argv[3];

if (rawAmount === "--help" || rawAmount === "-h") die("");
if (rawFlag !== undefined && rawFlag !== "anon") {
  die(`Unknown option "${rawFlag}". The only supported flag is "anon".`);
}
try {
  nimStringToLuna(rawAmount);
} catch {
  die(`"${rawAmount}" is not a valid NIM amount.`);
}

const amountNim = rawAmount;
const anonymous = rawFlag === "anon";

(async () => {
  const birthday = await prisma.birthday.findFirst({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    include: { wishes: { orderBy: { sortOrder: "asc" } } },
  });
  if (!birthday) {
    die("No published nimDay yet — create and publish one at /create first.");
  }
  if (birthday.wishes.length === 0) {
    die(`"${birthday.name}" has no wishes yet — add one and publish again.`);
  }
  const wish = birthday.wishes[0];

  const intent = await createPaymentIntent({
    slug: birthday.slug,
    wishId: wish.id,
    amountNim,
    anonymous,
  });

  const tx: PlainTxDetails = {
    transactionHash: randomBytes(32).toString("hex"),
    state: "confirmed",
    confirmations: 12,
    blockHeight: 1_000_000,
    timestamp: Date.now(),
    sender: "NQ55 GIVE R000 0000 0000 0000 0000 0000 0001",
    recipient: intent.recipientAddress,
    value: Number(intent.amountLuna),
    network: EXPECTED_NETWORK,
    data: { type: "raw", raw: Buffer.from(intent.memo, "utf8").toString("hex") },
  };

  const outcome = await applyTransactionToIntent(intent.id, tx);
  const updated = await prisma.wish.findUniqueOrThrow({ where: { id: wish.id } });

  console.log(
    JSON.stringify(
      {
        gaveTo: birthday.name,
        wish: wish.title,
        amountNim: intent.amountNim,
        anonymous,
        outcome,
        wishRaisedNim: lunaToNimString(updated.raisedLuna),
        page: `/b/${birthday.slug}`,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(`\n✖ ${await readThrown(err)}\n`);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
