# Phase 3 Results — Messages, Dashboard, Quest, Sharing, Polish

**Date:** 2026-09-03
**Scope:** Phase 3 only. No USDT, no NFTs/Gift Memory, no contracts, no custody, no
reward pools, no merchant integrations, no refunds, no randomness, no spend-based
rewards, no group requirements. Phase 2's payment infrastructure was **not** rebuilt.

> **What this phase was for:** Phase 2 proved the money works. Phase 3 makes NIMday
> feel like something you'd actually send to a friend — a birthday card with wishes,
> messages and a little celebration, where NIM is the rail and not the identity.

---

## 1. Features implemented

### Birthday messages

- **Anyone can leave one — no wallet, no account.** `POST /api/messages` is
  deliberately unauthenticated, like the gift-intent endpoint before it.
- **Named, unnamed or anonymous.** A visitor types a name (optional, remembered on
  their own device only), leaves it blank (shown as *"A friend"*), or ticks
  **Send anonymously** (shown as *"Someone"*). Anonymous is a display rule: the row
  keeps what we know, the API never returns it, and the UI says plainly that
  anonymity inside NIMday is not anonymity on-chain.
- **Optional gift association.** After a confirmed gift, the confirmation screen
  offers *"Leave a birthday message 💌"*, and that message carries a
  `🎁 gifted 4 NIM · Headphones` badge. The client sends a **payment-intent id**,
  never a gift id — the server resolves it, and only for a confirmed gift on this
  NIMday. **An anonymous gift is never linked**, because attaching a named message
  to it would tell the creator exactly who the anonymous giver was.
- **Server-side content rules** (`lib/messages/text.ts`, shared with the composer so
  they can't drift): control characters and zero-width tricks stripped, whitespace
  and blank-line runs collapsed, 240-character limit counted by code point (so emoji
  count as one), links rejected, sender name capped at 32.
- **Volume rules** (`lib/rateLimit.ts`): 5 messages per client per 10 minutes, and the
  same text twice in that window is refused.
- **Feed** — birthday-card style notes, tinted from the theme's own palette, newest
  first, with author, relative time and the gift badge. Server-rendered with the page.
- **States** — empty (*"be the first to wish Sarah a happy birthday"*), sending,
  success, error (with a resync in case the message actually landed), and a live
  character counter that appears near the limit.

### Creator dashboard — "My NIMday" (`/dashboard`)

A real page now, not a panel bolted to the bottom of the wizard.

- **Overview** — photo, name, birthday date, live countdown, Published/Draft status,
  Edit and Preview actions.
- **Share** — the full share block (see below), or a "publish first" prompt.
- **Gift summary** — gifts, total NIM, wishes filled, messages, then a progress bar
  per wish. Every number is read from the **Phase 2 gift ledger** (`Gift` rows with
  status `CONFIRMED`) — the same source the public page uses. No second source of
  truth was introduced.
- **Activity** — one feed mixing 🎁 gifts, 💌 messages and 🎉 fulfilled wishes,
  newest first. Anonymous gifts and messages show as "Someone" with no actor;
  named gifts show a masked `NQ55…0001`; **raw addresses are never returned**.
  A gift that was later reversed still appears, flagged as such rather than
  silently vanishing.
- The "fulfilled" moment is **derived by replaying the ledger** — the confirmed gift
  that first crossed the target — so it cannot drift from wish progress.

### Birthday Quest

Four steps, and deliberately not a game: `🎂 Visit the card` · `💌 Leave a message` ·
`🎁 Choose a wish` · `🎉 Celebrate your friend`.

- **No spending is rewarded, nothing is randomised, nothing is earned, and no step
  requires a wallet.** Choosing a wish completes step 3 whether or not a gift follows.
- **No database table.** Progress is derived from what the visitor does and kept in
  `localStorage` per NIMday, per device. Corrupt or hostile stored state parses back
  to "nothing completed" rather than throwing.
- Collapsed to a single line by default — an icon, the next step, `2 / 4 completed`
  and four progress pips. It sits *below* the wishes so it never competes with
  View wishes → Gift → Leave a message.
- "Celebrate your friend" fires a confetti burst that respects
  `prefers-reduced-motion`.

### Sharing

- `lib/share.ts` is now **the one place** that builds the public URL. The page, the
  dashboard, the publish response and the metadata canonical all go through it. The
  Nimiq Pay deep-link builder is untouched and still the only other URL format —
  a test asserts the deep link is that same `/b/<slug>` URL plus gift context.
- `ShareSection` — the link shown in full and copyable in one tap, a **Share** button
  using the Web Share API when present, a WhatsApp intent when it isn't, and a
  clipboard fallback with a visible prompt when even that is blocked (an insecure
  origin, for instance).
- Two voices: the creator shares *"It's my birthday…"*, a visitor shares
  *"It's Sarah's birthday — leave them a message or send a little gift"*. Neither
  mentions wallets, crypto or NIM.

### Public page + mobile polish

- `BirthdayCard` was split: it is now **the card** (photo, name, countdown, message)
  and nothing else. Wishes moved into a shared `WishList`, so the creator's preview,
  the marketing sample and the real public page render the identical component.
- Reading order is now: *this is Sarah's birthday* → *things Sarah would love* →
  the quest → *leave a message* → share. Payment mechanics stay inside the gift
  dialog until the visitor chooses to gift.
- Wish cards were rebuilt: larger imagery, clearer title/description hierarchy, a
  thicker animated progress bar, `12 of 120 NIM` with the raised figure emphasised,
  and a full-width **Send a gift** button (44px minimum tap target). A fulfilled wish
  reads *"🎉 Wish fulfilled!"* and its button becomes *"Give a little extra"*.
- Mobile-first throughout: single column by default, two columns only from `sm`;
  stacked share buttons that go side-by-side on wider screens; the gift dialog is
  now `max-h-[88dvh]` and scrolls internally; tap targets on the quest rows, the
  anonymous toggle and the copy-link pill are all ≥44px.
- The gift dialog **no longer closes on a backdrop tap while a payment is in flight**.

### Error handling

- `lib/gifts/failureCopy.ts` is the single place that turns an outcome into a
  sentence. Every `VerificationFailure` has copy; unknown reasons fall back to a
  plain sentence. A test asserts the copy never contains the machine reason.
  `wrong_recipient` now reads: *"We couldn't confirm this gift. The payment was sent
  to a different address."*
- `paymentStateCopy` covers CREATED / SUBMITTED / PENDING / CONFIRMED / FAILED /
  EXPIRED, plus a safe default. A test asserts a submitted payment is never
  described as *"sent"*.
- **No verification logic was changed to improve a message.**

---

## 2. Database changes

One table. Quest progress adds nothing.

| Model | Fields |
|---|---|
| **`Message`** (new) | `id`, `birthdayId` → Birthday (cascade), `body`, `senderName?` (display name the visitor typed), `senderAddress?` (wallet if one was connected — **never returned by the API**), `anonymous`, `giftId?` → Gift (`SET NULL`), `createdAt`. Indexes: `[birthdayId, createdAt]`, `[giftId]`. |
| `Birthday` | added `messages Message[]` |
| `Gift` | added `messages Message[]` |

Migration: `prisma/migrations/20260903140000_phase3_messages/migration.sql`.
No existing column changed; no data migration needed.

---

## 3. New routes and components

**Routes**

| Route | Purpose |
|---|---|
| `POST /api/messages` | leave a message — public, rate-limited, validated server-side |
| `GET /api/messages?slug=` | the message feed for a published NIMday |
| `GET /api/birthdays/me/dashboard` | the creator's own dashboard data (401 without a session) |
| `/dashboard` | "My NIMday" page — authorization on the server, no id in the URL |

**Components**

`components/WishList.tsx` (new, shared) · `components/public/MessageBoard.tsx` ·
`components/public/BirthdayQuest.tsx` · `components/public/Confetti.tsx` ·
`components/dashboard/DashboardView.tsx` · `ShareControls.tsx` → `ShareSection` ·
`BirthdayCard.tsx` (reduced to the card itself).
Removed: `components/create/GiftActivityPanel.tsx` — replaced by `/dashboard`.

**Libraries**

`lib/messages/text.ts` (pure) · `lib/messages/store.ts` · `lib/quest.ts` (pure) ·
`lib/share.ts` (pure) · `lib/activityText.ts` (pure) · `lib/dashboard.ts` ·
`lib/rateLimit.ts` · `lib/gifts/failureCopy.ts` (pure).

---

## 4. Tests added

**82 new tests across 7 files** — 64 unit, 18 against a real database.

| File | Covers |
|---|---|
| `tests/lib/messageText.test.ts` (17) | normalisation (whitespace, CRLF, control/zero-width chars, emoji preserved); empty / over-limit / link rejection; **emoji counted as one character, not two code units**; ordinary punctuation not mistaken for a link; name limits; attribution (`Someone` / `A friend` / the name) |
| `tests/lib/quest.test.ts` (11) | four steps and **no reward/prize/earn wording anywhere in them**; completion is idempotent, never reverses, never mutates its input; 0 / 2 / 4-step progress and labels; storage round-trip; malformed, hostile and `__proto__` input parse safely; per-slug key scoping |
| `tests/lib/share.test.ts` (10) | canonical URL, trailing slashes, slug escaping; **the deep link is that same URL plus gift context** (one URL format); creator vs visitor voice; no wallet/crypto jargon in share text; WhatsApp fallback encoding |
| `tests/lib/activityText.test.ts` (11) | gift / message / fulfilled copy; **anonymous never produces an identity or an `NQ` string**; reversed gifts flagged; `timeAgo` across every range plus clock skew and unparseable input; excerpt truncation |
| `tests/lib/failureCopy.test.ts` (7) | every `VerificationFailure` has copy; **copy never leaks the reason code or anything stack-trace shaped**; every payment state covered; "submitted" is never "sent"; safe defaults |
| `tests/lib/rateLimit.test.ts` (8) | limit, sliding window, key independence; duplicate detection and its expiry; client-key extraction and per-NIMday scoping |
| `tests/db/messages.test.ts` (18, real DB) | create named / unnamed / anonymous; **anonymous hides the name everywhere while the row keeps the address**; body normalised on write; empty / too long / links / long name rejected; unpublished and unknown NIMdays 404; rate limit and duplicate over HTTP; gift linked only when confirmed, this NIMday's, and not anonymous; one badge per gift; dashboard totals, wish progress, message count, mixed activity feed, anonymity in the feed, newest-first ordering, **confirmed gifts only** (a reversed gift is excluded from totals but still shown); 401 without a session; **another creator never sees this NIMday** |

Two Phase 2 tests were also made configuration-independent (see §6).

---

## 5. Test results

```
npm test                       169 passed | 42 skipped   (no database)
DATABASE_URL=… npx vitest run  209 passed |  1 failed | 1 skipped
```

`--no-file-parallelism` is needed with the bundled PGlite dev database — a single
PGlite instance doesn't cope with several test files hitting it at once.

**The one failure is pre-existing and documented in Phase 2:** `enforces unique
slugs` in `tests/db/birthday.test.ts`. PGlite-over-socket drops the connection on a
constraint violation instead of returning a clean error, so the *next* test's cleanup
fails. It passes on real PostgreSQL. Not a Phase 3 change — the failure is in a
Phase 1 test that Phase 3 does not touch.

The skipped test is the live-mainnet check (`RUN_MAINNET_TESTS=1`), unchanged.

---

## 6. Build / lint / typecheck

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run lint` | ✓ no warnings or errors |
| `npm run build` | ✓ 25 routes (was 22) — `/dashboard` 5.02 kB, `/api/messages`, `/api/birthdays/me/dashboard`; `/b/[slug]` grew 5.6 kB → 8.82 kB (121 kB first load) |

### Two pre-existing issues fixed on the way

Both were found because they made this phase's verification impossible, and both are
one-line changes with no effect on verification logic:

1. **The Phase 2 gift tests hardcoded `NIMIQ_MAINNET`** while the code reads
   `EXPECTED_NETWORK` from `NIMIQ_NETWORK`. Your `.env` is set to `testalbatross`
   for phone testing, and Prisma Client loads `.env` — so 8 Phase 2 tests failed
   before a line of Phase 3 was written. The tests now use `EXPECTED_NETWORK`, so
   they pass whichever network the app is pointed at.
2. **`/api/dev/mock-verify` hardcoded `"mainalbatross"`**, which made the dev
   verification helper unusable whenever the app was on testnet. It now defaults to
   `EXPECTED_NETWORK`.

---

## 7. Manual E2E

Executed over real HTTP against a running dev server and a real database, scripted as
`npm run e2e:phase3` (`scripts/e2e-phase3.mjs`) so it is reproducible.

**35 / 35 checks passed.**

| Flow | Checks |
|---|---|
| **Creator** | sign in · create NIMday with two wishes · publish · dashboard empty state with countdown (112 days) and the canonical link · `/dashboard` renders |
| **Visitor** | public page loads with no wallet and no session · card, quest, wishes and composer all present · empty message state · **no wallet/blockchain/Luna jargon in the rendered page** |
| **Messages** | named · anonymous (name absent from the payload) · unnamed → "A friend" · empty rejected · 300 chars rejected · link rejected · duplicate rejected · burst rate-limited · feed newest-first with **no `NQ` string anywhere** · messages server-rendered, anonymous name absent from the HTML |
| **Payment regression** | intent created with a **server-derived** recipient and a deep link carrying `/b/<slug>?gift=1&intent=` · submitting a hash sets SUBMITTED and credits nothing · **wish progress still `0 of 10 NIM`** · mock-verify credits · progress moves to `4 of 10 NIM` · reaching the target renders "🎉 Wish fulfilled!" |
| **Message ↔ gift** | a message after a confirmed gift carries `4 NIM · Headphones` · **a message after an anonymous gift carries no badge** |
| **Dashboard** | totals from the ledger (2 gifts, 10 NIM) · 1/2 wishes filled, 10 messages · feed contains gift + message + fulfilled · anonymous gift `actor: null`, named gift `NQ55…0001` · **no raw address anywhere in the payload** · newest-first · page renders the share block and the numbers |
| **Authorization** | dashboard API 401 without a session · signed-out `/dashboard` shows a sign-in prompt and **none of the creator's data** |

The quest was exercised by hand in the browser (visit ticks step 1, sending a message
ticks step 2, opening a wish ticks step 3, Celebrate fires confetti and ticks step 4;
progress survives a reload and is scoped per NIMday). Its logic is unit-tested;
`localStorage` behaviour itself is not covered by an automated test.

### What was *not* tested

- **No real Nimiq Pay device.** The gift half of the E2E runs synthetic transactions
  through the real verification and credit code, exactly as in Phase 2. No real NIM
  moved. The three Phase 2 device checks remain as they were — this phase did not
  touch `verifySignature.ts`, `txResult.ts` or `deepLink.ts`.
- **No automated visual or cross-browser testing.** Layout was verified from the
  rendered markup and by mobile-first review of every touched component, not by
  screenshots on real devices. The 44px tap targets, `dvh` sizing and single-column
  defaults are in the markup; how they *look* on a given phone is unverified.
- **No accessibility audit.** Progress bars, the quest and the composer carry ARIA
  roles and labels, but no screen-reader or contrast pass was run.

---

## 8. Known limitations

- **Rate limiting is in-process.** `lib/rateLimit.ts` bounds one server instance.
  Behind multiple instances the effective limit multiplies, and it resets on deploy.
  It stops someone holding down "send"; it is not a defence against a determined
  attacker. A shared store is the real fix.
- **No moderation, by design.** Content rules reject empty, over-long, link-bearing
  and duplicate messages. Nothing filters abusive text, and there is **no way for a
  creator to delete a message they've received** — a real gap for a public page, and
  the most obvious next thing to build.
- **Quest progress is per-device.** A different browser or a cleared cache starts
  over. That is the trade for adding no table and no tracking; it also means the
  quest is not a record of anything, only a nudge.
- **The message feed loads 50 at a time with no pagination.** Fine at MVP scale.
- **`GET /api/messages` and `POST /api/messages` are unauthenticated** — as they must
  be — so they share the pre-existing "no rate limiting on public endpoints" caveat
  with `/api/gifts/intent`, which still has none.
- **A named message can be linked to a gift only once**, and only if the visitor
  writes it in the same session as the confirmation screen. Re-opening the page later
  loses that association.
- **The dashboard loads the whole gift list** to derive fulfilment moments. Correct
  and cheap at MVP scale; it would need a bounded query at volume.
- **Both `Message.senderName` and `senderAddress` are stored for anonymous messages
  only where they were supplied** — the name is deliberately dropped at write time
  for an anonymous send, so it cannot leak later even by a bug in the read path.
- Carried over from Phase 2 and unchanged: one worker with no queue; reconciliation
  is O(open recipients); 30-minute intent expiry; `Wish.raisedLuna` is a cache with
  no periodic re-derivation; local disk image storage; one NIMday per wallet; the
  three Nimiq Pay device checks.

---

## 9. Remaining polish opportunities

- **Creator moderation** — hide or delete a message. The most important omission.
- **Live updates** — the public page doesn't poll, so a visitor reading it doesn't
  see messages that arrive while they're there.
- **Message reactions** — a single tap 🎉 would be cheaper than a message and would
  suit the people who open the link but don't write.
- **Richer OG image** — still an SVG, and it doesn't show wish progress or message
  count, which is what would make a shared link tempting to open.
- **A real "next birthday" moment** — the growth loop ends at "Made with NIMday";
  after a visitor leaves a message is the natural place to ask when *their* birthday
  is.
- **Reduced-motion is honoured by the confetti but not by the progress-bar
  transition**, which still animates.
- **Empty-state photography/illustration** — the empty message and activity states
  are an emoji and a sentence; they're the screens a new creator sees most.
- **Character counter only appears near the limit** — some people would rather see it
  from the first keystroke.

---

## Security — Phase 2 properties preserved

Nothing in this phase weakened authentication, authorization or the payment path.

- **No private keys, no custody, no contracts.** Unchanged — Phase 3 added no
  money-moving code at all.
- **Payment verification untouched.** `verification.ts`, `credit.ts`, `process.ts`,
  `intent.ts` and the worker were not modified. The only change anywhere near them is
  human-readable copy in a separate module, and a dev-only route's default network.
- **No frontend payment trust, no client-controlled totals or wish progress.** The
  dashboard reads the same ledger; the message endpoint cannot touch money.
- **The client never supplies a gift id.** It sends a payment-intent id; the server
  checks the intent exists, belongs to this NIMday, is CONFIRMED, has a CONFIRMED
  gift, and isn't anonymous — and that no message already claims that gift.
- **Anonymous never leaks.** Verified at three levels: the store resolves the display
  name and omits `senderAddress` entirely; an anonymous gift is never linked to a
  message; and `toPublic` re-checks anonymity on the gift *and* the message before
  emitting a badge. Tests assert no `NQ` string appears in message or dashboard
  payloads.
- **Creator operations stay creator-only.** `/dashboard` resolves the session
  server-side and queries by `creatorId` — there is no id in the URL to tamper with.
  `GET /api/birthdays/me/dashboard` returns 401 without a session, and a different
  creator gets `null`, not someone else's NIMday. Both are tested.
- **Message limits are enforced server-side.** The composer shares the same pure
  rules for immediate feedback, but the server re-runs every one of them; a crafted
  request bypasses nothing.
- **Duplicate gift records still impossible** — unchanged `Gift.txHash` uniqueness
  plus the `ProcessedTransaction` guard.
- **Stored input is escaped by React and length-bounded**; control characters and
  zero-width characters are stripped before storage.

---

**PHASE 3 STATUS: COMPLETE**

NIMday now reads as a birthday product: a card first, wishes second, a message
anyone can leave without a wallet, a small celebration journey, and one obvious link
to share. The creator has a real "My NIMday" page whose numbers come from the same
verified ledger the public page reads. The Phase 2 payment loop was not rebuilt and
still passes its regression checks end to end.

Not started: Phase 4.
