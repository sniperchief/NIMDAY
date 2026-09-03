# Phase 2 Results — NIM Gifting + Payment Verification

**Date:** 2026-09-03
**Scope:** Phase 2 only. NIM-only. No USDT, no NFTs, no rewards, no custody, no refunds.

> **The rule this phase exists to enforce:** a payment becomes a gift only after
> NIMday's own backend verifies a **confirmed** on-chain transaction. Submitting a
> transaction hash, or any other frontend claim, never credits anything.

---

## What was built

- **Payment intents** — created server-side before any money moves, with the recipient
  address **derived from the wish's birthday's creator**, never taken from the client.
- **Integer-only money** (`src/lib/money.ts`) — NIM ⇄ Luna via `bigint`; no floating point
  anywhere in the monetary path. Rejects zero, negatives, >5 dp, and unsafe magnitudes.
- **Compact memo** — `nimday:<14-char id>` (21 bytes, well under the 64-byte cap), unique
  per intent, used to bind an on-chain transaction to an intent.
- **Gift flow UI** — tap a wish → choose amount + anonymous → intent created → either the
  Nimiq Pay hand-off (deep link carrying slug + intent) or, inside Nimiq Pay, connect →
  review → `sendBasicTransactionWithData` → "submitted, verifying…" → "Gift confirmed 🎁".
- **Isolated transaction-result adapter** (`nimiq/txResult.ts`) — the single place that
  interprets what `sendBasicTransactionWithData()` returns.
- **Verification worker** (`worker/index.ts`) — always-on Node process with a warm
  `@nimiq/core` light client: transaction listener, confirmation polling, reconciliation
  sweep, expiry, and invalidation reversal.
- **Gift ledger** — `Gift` (unique `txHash`) + `ProcessedTransaction` (audit + second
  idempotency guard), credited atomically with wish progress.
- **Wish progress** — `received / target NIM` with a bar, from verified gifts only;
  "🎉 Wish fulfilled!" at target. Never incremented optimistically.
- **Anonymous gifting** — real sender always stored; hidden from the creator and the
  public page when chosen. (Anonymous in NIMday, not on-chain — stated in the UI.)
- **Creator gift activity** — count, total NIM, per-gift wish/amount/time, "Someone" for
  anonymous, a masked `NQ55…0001` label otherwise. Never a raw address.
- **Payment statuses** end-to-end: ready → connecting → awaiting approval → submitted →
  verifying → confirmed / failed / expired, each with human-readable copy.

## Payment flow

1. Visitor opens `/b/<slug>` (no wallet needed) and taps a wish.
2. Chooses an amount and whether to give anonymously.
3. `POST /api/gifts/intent` → server validates the birthday is published, the wish exists
   and is NIM, and the amount parses to positive integer Luna; it generates a unique
   `shortId`, derives the recipient address itself, and stores a `CREATED` intent.
4. Outside Nimiq Pay: the visitor gets a deep link
   (`https://nimpay.app/miniapps/open/<origin>/b/<slug>?gift=1&intent=<id>`) and finishes
   in the app, where the page resumes the same intent.
5. Inside Nimiq Pay: connect wallet → review (recipient, wish, amount, sender) → approve
   → `sendBasicTransactionWithData({ recipient, value: Luna, data: memo })`.
6. `POST /api/gifts/intent/<id>/submit` records the returned hash. Status becomes
   **SUBMITTED**. The UI says *"Payment submitted — verifying"*, never *"sent"*.
7. The worker fetches the transaction, runs every rule, and credits **only** at
   `state === "confirmed"`. Status becomes **CONFIRMED**, the gift row appears, and wish
   progress increases — atomically.
8. The giver's UI polls the status and shows *"Gift confirmed 🎁"* with name, wish, amount.

## Verification architecture

A single always-on worker (`npm run worker`) holds one `@nimiq/core` light client that
reaches Nimiq mainnet consensus with **no self-hosted node and no RPC endpoint**. Per tick
(default 8s) it:

- **polls submitted intents** — `getTransaction(hash)` → verify → credit or keep waiting;
- **reconciles** — `getTransactionsByAddress(recipient)` for every open intent's recipient,
  matching by memo `shortId`, so a missed listener event, a giver who never called
  `/submit`, or worker downtime all recover on their own;
- **expires** intents that lapsed with no confirmed payment;
- **reverses** gifts whose transaction later reports `invalidated`.

`addTransactionListener(addresses)` gives low-latency detection on inclusion; `getTransaction`
is always the authority for finality. Every operation is idempotent, so restarts are safe.
Verification itself (`src/lib/gifts/verification.ts`) is a **pure function** over the intent
plus plain transaction details — no database, no network — which is what makes the rule
matrix directly testable.

**Rules — all must pass:** correct currency (NIM) · network `mainalbatross` · recipient
exactly equals the server-derived creator address · sender recorded (and matched when the
intent pinned one) · memo decodes to this intent's `shortId` · value (integer Luna) ≥ the
chosen minimum · `state === "confirmed"` · `txHash` not already processed. `new`/`pending`/
`included` are retryable (stay PENDING); `invalidated`/`expired` and every mismatch fail
loudly with a stored reason.

## Database changes

| Model | Purpose |
|---|---|
| `PaymentIntent` | birthday, wish, `recipientAddress`, `expectedAmountLuna`/`minAmountLuna` (BigInt), unique `shortId` + `memo`, `anonymous`, `senderAddress`, `txHash`, `status`, `failureReason`, `expiresAt`. Indexes on `status`, `birthdayId`, `txHash`. |
| `Gift` | intent (unique 1-1), birthday, wish, `senderAddress`, `recipientAddress`, `amountLuna` (BigInt), **`txHash` unique**, `shortId`, `anonymous`, `status` (CONFIRMED/REVERSED), `confirmedAt`. |
| `ProcessedTransaction` | `txHash` primary key — independent double-credit guard + audit trail, with `reversedAt`. |
| `WorkerCheckpoint` | single-row bookmark for the reconciliation sweep. |
| `Wish.raisedLuna` | BigInt cache of verified contributions, updated inside the credit transaction. |
| enums | `PaymentIntentStatus` (CREATED/SUBMITTED/PENDING/CONFIRMED/FAILED/EXPIRED), `GiftStatus`. |

## Security

- The client **never** supplies the recipient — it is read from `birthday.creator.walletAddress`.
- A submitted `txHash` is a *claim*; it sets status SUBMITTED and nothing else.
- Credit requires `state === "confirmed"` plus every other rule; `included` is not enough.
- Double-credit is blocked twice: a `ProcessedTransaction` pre-check inside the transaction
  **and** unique constraints on `Gift.txHash` / `ProcessedTransaction.txHash`, with the
  `P2002` race caught and reported as already-credited.
- Credit is a single `prisma.$transaction`: gift + ledger row + intent status + wish
  progress all commit together or not at all.
- Overpayment credits the **actual** verified amount; underpayment fails with
  `amount_too_low` rather than silently.
- Anonymity is display-only — the real sender is always stored for audit; the API omits it.
- Creator gift activity is scoped through the authenticated session's own birthday; raw
  addresses are never returned, only masked labels.
- No private keys, seed phrases, custody wallet, payout wallet, or contracts. NIMday never
  holds funds; payments go wallet → wallet.
- `dev/mock-verify` and `dev-login` are hard-disabled in production and behind `ALLOW_DEV_LOGIN`.

## Tests

`npm test` — **99 passed, 24 skipped** (skips = DB-integration + the live-mainnet test).
With a database: **121 passed, 1 failed, 1 skipped**. typecheck ✓ · lint ✓ (no warnings) ·
`next build` ✓ (22 routes).

*The one failure is the pre-existing Phase 1 `enforces unique slugs` case, which only fails
on the bundled PGlite dev database — PGlite-over-socket drops the connection on a constraint
violation instead of returning a clean error. It passes on real Postgres. Not a Phase 2 change.*

- **Amount conversion** (13): 1 NIM = 100 000 Luna; `1.25 → 125000`; `0.00001 → 1`; rejects
  zero, negatives, >5 dp, non-numeric, `1e5`, absurd magnitudes; SDK-value range guard.
- **Verification rules** (11): correct tx accepted; overpayment credits actual; wrong
  recipient / wrong sender / wrong network / wrong memo / non-NIM / amount-too-low rejected;
  `new`/`pending`/`included` not credited (retryable); `invalidated` not credited.
- **Payment intents + credit, real DB** (12): valid intent with server-derived recipient;
  rejects unpublished birthday, non-NIM wish, invalid amount; credits a confirmed tx and
  advances progress; **never credits the same transaction twice**; unconfirmed → PENDING then
  credited once confirmed; wrong recipient fails **without touching progress**; invalidated
  gift reversed (progress rolled back, gift REVERSED, intent FAILED); stale intents expire;
  activity scoped per creator with anonymity respected; a memo for another intent is rejected.
- **Routes, real DB** (4): intent → submit → verify → confirmed with progress and creator
  activity; bad wish → 404; amount 0 → 400; `me/gifts` requires auth.
- **Atomicity**: asserted by checking that a credited transaction leaves gift +
  `ProcessedTransaction` + intent status + `wish.raisedLuna` all consistent, and that a
  failed verification leaves **none** of them changed.
- **Authorization**: creator activity is fetched via the session's own birthday only; one
  creator's gifts never appear in another's (plus the Phase 1 ownership guard tests).
- **Memo/shortId** (5) and **tx-result adapter** (4) and **deep links** (5).

### Real vs simulated — stated plainly

| | |
|---|---|
| **Real Nimiq mainnet verification** | ✅ **Executed.** `tests/nimiq/mainnet.test.ts` (`RUN_MAINNET_TESTS=1`) spins the real `@nimiq/core` client, reaches consensus, confirms `networkId 24`, pulls live confirmed transactions with `getTransactionsByAddress`, and runs them through the production verification rules. The worker was also started against mainnet and logged `consensus established, head #60614668`, then completed a reconciliation sweep (checkpoint written). |
| **Simulated payment submission** | ✅ **Executed.** Full loop over HTTP against a live dev server + database: intent → submit hash (stays SUBMITTED, progress 0) → `included` state → PENDING, no credit → wrong recipient → `failed: wrong_recipient` → correct confirmed tx → `credited`, status CONFIRMED → same tx again → `already`, same gift id, no double credit → progress 0 → 4 → 6 NIM → anonymous gift hides the sender → overpayment (intent 2 NIM, sent 5) credits 5 and shows "Wish fulfilled" → invalidation reverses it (11 → 6 NIM, gift REVERSED, intent FAILED, totals 3→2 gifts). The transaction data is synthetic; the verification and credit code paths are the real ones. |
| **Actual Nimiq Pay device payment** | ❌ **Not performed.** No Nimiq Pay device was available. No real NIM moved at any point in this phase. |

## Device checks

| Check | Status |
|---|---|
| exact bytes signed by `sign()` | **PENDING** — no device. `verifyNimiqSignature` still tries all three candidate encodings and reports which matched; pin `PINNED_ENCODING` in `src/lib/nimiq/verifySignature.ts` after the test. |
| `sendBasicTransactionWithData()` return value | **PENDING** — no device. Treated as the documented transaction hash; every interpretation is isolated in `src/lib/nimiq/txResult.ts`, which already tolerates `0x` prefixes, casing, and an object wrapper. `parseSendResult` is unit-tested. |
| deep-link preservation of `/b/<slug>` + payment context | **PENDING** — no device. All construction is in `src/lib/nimiq/deepLink.ts` (`giftTargetUrl` / `giftDeepLink`); the public page already reads `?gift=1&intent=<id>` and resumes the intent, so only the link shape would change. |

No results were fabricated for any of these.

## Known limitations

- **The three device checks above are unverified.** Until `sendBasicTransactionWithData`'s
  return value is confirmed on hardware, a real gift could stall at "verifying" — though the
  worker's reconciliation sweep would still find and credit the payment by memo, which is
  exactly why that path exists.
- **One worker, no queue.** Sufficient for the MVP and idempotent, but it is a single point
  of latency; if it is down, gifts sit as SUBMITTED until it returns (then reconcile).
- **Reconciliation is O(open recipient addresses)** per tick, scanning the 25 most recent
  transactions each. Fine at MVP scale, not at thousands of concurrent intents.
- **Intent expiry is 30 minutes.** A payment confirmed after that is still recovered by the
  reconciliation sweep, but the intent will already read EXPIRED to the giver.
- **Reversal is a compensating adjustment**, not double-entry accounting: the gift is marked
  REVERSED, progress is decremented, the ledger row keeps `reversedAt`. Deliberately simple.
- **No fee handling or balance pre-check** — if the wallet lacks NIM for the amount plus fee,
  the failure surfaces from Nimiq Pay as a wallet error, not as an upfront warning.
- **`Wish.raisedLuna` is a cache.** It is only ever written inside the credit/reverse
  transaction, but there is no periodic re-derivation from the gift table yet.
- Carried over from Phase 1: local disk image storage, SVG (not PNG) OG image, one NIMday
  per wallet, no rate limiting on public endpoints (`/api/gifts/intent` is unauthenticated —
  worth a limiter before launch).

## Phase 3 readiness

- **Birthday messages** — the public page is already a client island
  (`PublicBirthdayView`) with a working modal pattern and an unauthenticated write path
  (`/api/gifts/intent`) to copy for message posting; anonymity handling is solved and reusable.
- **Dashboard improvements** — `getGiftActivity` already returns items + totals; the
  `GiftActivityPanel` component is a drop-in for a fuller "My NIMday" page, and per-wish
  progress is in the public DTO.
- **Birthday Quest** — the quest steps map to states that now exist and are queryable:
  viewed the card, chose a wish (intent CREATED), sent a gift (Gift CONFIRMED), left a
  message (Phase 3). No spend-based rewards anywhere to unpick.
- **Final polish** — payment statuses, error copy, and the verification seam are settled;
  what remains is visual and copy work, plus rate limiting and the device checks.

---

**PHASE 2 STATUS: COMPLETE**

The gifting loop works end to end and is verified: a payment becomes a gift only after
NIMday's backend independently confirms the transaction on the Nimiq network. Real mainnet
verification is executed and passing; the payment submission half was exercised with
synthetic transactions through the real verification and credit code. No real-wallet payment
was made, and the three Nimiq Pay device checks remain PENDING — each isolated to a single
module so confirming them is a one-line change.

Do not proceed to Phase 3 without sign-off.
