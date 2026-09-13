/**
 * The gift a real device was refused, replayed through the real processing and
 * crediting code (`applyTransactionToIntent` -> `creditGift`), with a small
 * in-memory database standing in for Prisma.
 *
 * What happened on the device: the giver connected, NIMday stored the first
 * address Nimiq Pay listed and pinned it to the intent, and the wallet then paid
 * from a different one of the giver's accounts. Verification rejected a genuine,
 * correctly addressed, correctly memo'd payment as `wrong_sender`.
 *
 * No real database is touched: every call goes to the fake passed in as `db`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { applyTransactionToIntent } from "@/lib/gifts/process";
import { EXPECTED_NETWORK, type PlainTxDetails } from "@/lib/gifts/verification";
import { memoFor } from "@/lib/gifts/shortId";

const RECIPIENT = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";
const LISTED_FIRST = "NQ55 1111 1111 1111 1111 1111 1111 1111 1111"; // what listAccounts()[0] returned
const ACTUALLY_PAID = "NQ55 2222 2222 2222 2222 2222 2222 2222 2222"; // the account the wallet used
const SHORT_ID = "devicegift0001";

type Row = Record<string, unknown>;

/** Just the Prisma surface process.ts and credit.ts use. */
function makeDb() {
  const tables = {
    paymentIntent: [] as Row[],
    gift: [] as Row[],
    processedTransaction: [] as Row[],
    wish: [] as Row[],
  };
  const find = (rows: Row[], where: Row) =>
    rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;

  const table = (rows: Row[]) => ({
    findUnique: async ({ where }: { where: Row }) => find(rows, where),
    create: async ({ data }: { data: Row }) => {
      const row = { id: `row-${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = find(rows, where);
      if (!row) throw new Error("not found");
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && "increment" in (v as Row)) {
          row[k] = (row[k] as bigint) + ((v as Row).increment as bigint);
        } else if (v && typeof v === "object" && "decrement" in (v as Row)) {
          row[k] = (row[k] as bigint) - ((v as Row).decrement as bigint);
        } else {
          row[k] = v;
        }
      }
      return row;
    },
  });

  const models = {
    tables,
    paymentIntent: table(tables.paymentIntent),
    gift: table(tables.gift),
    processedTransaction: table(tables.processedTransaction),
    wish: table(tables.wish),
  };
  // Inside the transaction credit.ts only touches the models, so hand them over.
  return {
    ...models,
    $transaction: async <T>(fn: (t: typeof models) => Promise<T>) => fn(models),
  };
}

function devicePayment(over: Partial<PlainTxDetails> = {}): PlainTxDetails {
  return {
    transactionHash: "d".repeat(64),
    state: "confirmed",
    confirmations: 12,
    sender: ACTUALLY_PAID,
    recipient: RECIPIENT,
    value: 100_000,
    network: EXPECTED_NETWORK,
    data: { type: "raw", raw: Buffer.from(memoFor(SHORT_ID), "utf8").toString("hex") },
    ...over,
  };
}

describe("a gift paid from a different account than the one listed on connect", () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    db.tables.wish.push({ id: "wish-1", raisedLuna: 0n });
    db.tables.paymentIntent.push({
      id: "intent-1",
      birthdayId: "birthday-1",
      wishId: "wish-1",
      recipientAddress: RECIPIENT,
      currency: "NIM",
      expectedAmountLuna: 100_000n,
      minAmountLuna: 100_000n,
      shortId: SHORT_ID,
      memo: memoFor(SHORT_ID),
      anonymous: false,
      // pinned by attachTransaction from the address the wallet listed first
      senderAddress: LISTED_FIRST,
      txHash: "d".repeat(64),
      status: "SUBMITTED",
    });
  });

  const run = () =>
    applyTransactionToIntent(
      "intent-1",
      devicePayment(),
      db as unknown as Parameters<typeof applyTransactionToIntent>[2],
    );

  it("is credited instead of being refused as wrong_sender", async () => {
    const outcome = await run();
    expect(outcome.result).toBe("credited");
    expect(db.tables.paymentIntent[0].status).toBe("CONFIRMED");
    expect(db.tables.paymentIntent[0].failureReason).toBeUndefined();
  });

  it("records the account that actually paid, not the one listed on connect", async () => {
    await run();
    expect(db.tables.gift).toHaveLength(1);
    expect(db.tables.gift[0].senderAddress).toBe(ACTUALLY_PAID);
    // the intent's stale claim is replaced by the real sender
    expect(db.tables.paymentIntent[0].senderAddress).toBe(ACTUALLY_PAID);
  });

  it("moves wish progress by the verified amount", async () => {
    await run();
    expect(db.tables.wish[0].raisedLuna).toBe(100_000n);
    expect(db.tables.gift[0].amountLuna).toBe(100_000n);
  });

  it("still credits only once if the worker sees it again", async () => {
    await run();
    const again = await run();
    expect(again.result).toBe("already");
    expect(db.tables.gift).toHaveLength(1);
    expect(db.tables.wish[0].raisedLuna).toBe(100_000n);
  });

  it("still refuses a payment carrying another gift's memo, whoever sent it", async () => {
    const outcome = await applyTransactionToIntent(
      "intent-1",
      devicePayment({
        data: {
          type: "raw",
          raw: Buffer.from(memoFor("someothergift1"), "utf8").toString("hex"),
        },
      }),
      db as unknown as Parameters<typeof applyTransactionToIntent>[2],
    );
    expect(outcome).toMatchObject({ result: "failed", reason: "wrong_memo" });
    expect(db.tables.gift).toHaveLength(0);
    expect(db.tables.wish[0].raisedLuna).toBe(0n);
  });

  it("still refuses a payment to someone else's address", async () => {
    const outcome = await applyTransactionToIntent(
      "intent-1",
      devicePayment({ recipient: "NQ07 9999 9999 9999 9999 9999 9999 9999 9999" }),
      db as unknown as Parameters<typeof applyTransactionToIntent>[2],
    );
    expect(outcome).toMatchObject({ result: "failed", reason: "wrong_recipient" });
    expect(db.tables.gift).toHaveLength(0);
  });
});
