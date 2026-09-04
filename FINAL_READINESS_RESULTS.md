# Final Readiness — Audit, Fixes and Verification

**Date:** 2026-09-03
**Scope:** Audit and hardening of the existing Phase 1–3 build. No new feature
phase: no USDT, no NFTs/Gift Memory, no contracts, no custody, no rewards, no
randomness, no merchant or delivery integrations, no analytics, no new social
systems. The Phase 2 payment implementation was **not** rewritten.

> **The question this phase had to answer:** can a real person create a birthday
> NIMday, share it, and have another real person understand it, interact with
> it, and gift NIM through Nimiq Pay? Everything below is either a defect that
> stood in the way of that, or evidence about how far it has actually been
> proven.

---

## 1. Audit

Read against `PRD.md`, plus the technical plan and the four phase result
documents (kept as internal working notes, not published to this repo),
then walked the code: every API route, the authorization helpers, the payment
path, the message path, and the client components on the three screens that
matter (public page, create flow, dashboard).

### P0 — must fix

| # | Finding | Status |
|---|---|---|
| **P0-1** | **Deleting a wish destroyed its gift and payment records.** `Gift.wishId` and `PaymentIntent.wishId` both cascade from `Wish`, and `DELETE /api/wishes/[id]` had no guard. Worse, it wasn't a manual action: `CreateWizard.reconcileWishes` calls it automatically for every wish missing from the local draft, so a creator who received gifts and then edited their wishlist — or published from a stale `localStorage` draft — silently erased rows from the authoritative gift ledger. Totals shrank, activity lost the gift, and `ProcessedTransaction` rows were left pointing at a gift that no longer existed, weakening the second double-credit guard. | **Fixed** |
| **P0-2** | **A creator could not delete a message left on their own NIMday.** Carried over from Phase 3 as the known gap. On a public page anyone can write to, that is not optional at release. | **Fixed** |
| **P0-3** | **`NIMIQ_NETWORK` had two independent readers and no validation.** `gifts/verification.ts` and `nimiq/client.ts` each read the variable and each wrote their own `"mainalbatross"` default. Two consequences: a typo (`mainnet`, `main-albatross`) was accepted silently and then rejected *every* real payment as `wrong_network`; and a testnet value in a production deployment would credit worthless test NIM as real gifts, with nothing in the product saying so. This is the `NIMIQ_NETWORK` hazard the brief flagged. | **Fixed** |

### P1 — should fix

| # | Finding | Status |
|---|---|---|
| P1-1 | The gift dialog could be dismissed with **Escape while a payment was in flight** — the backdrop guarded against this, the key handler did not. Losing the dialog mid-send leaves the giver with no idea what happened to their NIM. | Fixed |
| P1-2 | `role="dialog"` / `aria-modal` sat on the **backdrop**, not the panel; nothing moved focus into the dialog; the page scrolled behind it; and the sending / verifying / confirmed / failed states were not announced. | Fixed |
| P1-3 | A **session that expired mid-publish** surfaced only as "Sign in to continue" on the preview step, with no route back. | Fixed |
| P1-4 | **No root `error.tsx` or `not-found.tsx`.** An unexpected server or render error fell through to Next's default screen. | Fixed |
| P1-5 | `Button`'s **loading state was invisible to assistive tech** (disabled, with no `aria-busy` and no text), and no button had a `focus-visible` ring. | Fixed |
| P1-6 | **"Copied ✓" was conveyed by a glyph and colour change alone** — nothing announced it. | Fixed |
| P1-7 | **No `loading.tsx`** for the public page or dashboard, so a client-side navigation showed nothing until the server responded. | Fixed |
| P1-8 | No explicit **viewport** was declared. | Fixed |
| P1-9 | The **`enforces unique slugs` test failure**, documented since Phase 2 as an infrastructure limitation. It turned out to be fixable without weakening anything — see §4. | Fixed |
| P1-10 | The **countdown pill wrapped awkwardly** at 390px: `112 days until Sarah's birthday · turning 30` broke over two lines inside a `rounded-full` pill, and the trailing `· turning 30` sat oddly against the centred first line. `inline-flex` made the label and the age separate flex items, so the label wrapped inside its own box while the age stayed pinned alongside it. Fixed in `src/components/Countdown.tsx`: laid out as one centred inline text run, the countdown now reflows correctly on narrow screens. | Fixed |

### P2 — noted, not changed

- `NEXT_PUBLIC_ALLOW_DEV_WALLET` is inlined at build time, so a production build
  made with it set would render "Use a test wallet (dev)". The button is inert —
  `/api/auth/dev-login` refuses on `NODE_ENV === "production"` regardless — so
  this is a cosmetic leak, not an auth bypass. Left alone rather than adding a
  second flag to reason about.
- `POST /api/gifts/intent/[id]/submit` will attach any well-formed hash to any
  intent id. Verification then rejects it (the memo must carry *that* intent's
  `shortId`), so it cannot credit anything — but someone who knew a stranger's
  intent id could push it to `FAILED`. The id is an unguessable cuid held only
  by the giver's own client. Not worth new machinery at MVP scale.
- An anonymous message still stores `senderAddress` when one was supplied. The
  API never returns it and no screen reads it; the *name* is dropped at write
  time. Unchanged from Phase 3, and documented there.

---

## 2. Features and fixes

### Message deletion (the required feature)

`DELETE /api/messages/[id]` → `deleteMessageAsCreator(userId, messageId)`.

- **Creator only, enforced on the server.** The request carries nothing but the
  message id. Ownership is resolved by loading the message and comparing its
  birthday's `creatorId` to the id on the **session** — there is no creator id,
  birthday id or slug in the request to tamper with. 401 without a session, 403
  for a different creator, 404 for a message that is already gone.
- **Money is untouchable from here.** The only link between a message and a gift
  is `Message.giftId`, which points *at* the gift. Deleting the message writes
  one row and nothing else: `Gift`, `PaymentIntent`, `ProcessedTransaction` and
  `Wish.raisedLuna` are all unchanged, so removing a note can never move a total
  or a progress bar.
- **Anonymity survives.** The delete response returns an id and nothing else, and
  the creator's message list is built from the same `listMessages` the public
  page uses — so the creator's own view can never show more about a sender than
  a visitor sees. An anonymous message is still "Someone" on the screen where
  it is deleted.
- **UI:** a new **Messages** card on `/dashboard`, between Gifts and Activity.
  Each note shows body, author, time and its gift badge, with a **Remove**
  action that expands into an in-place confirmation ("Remove this message from
  your NIMday? … The gift itself is untouched — only the note goes."), a
  loading state, an error message, and a polite live-region announcement on
  success. `router.refresh()` re-pulls the server-rendered totals so the message
  count matches what was just removed.
- **Not a moderation system.** No hiding, editing, reporting, blocking or
  filtering — one action, on your own card.

### The gift ledger now outranks the wishlist (P0-1)

`DELETE /api/wishes/[id]` counts `Gift` rows first and returns **409** with a
human sentence if there are any: *"Headphones" has already received a gift, so
it can't be removed. You can rename it or change its target instead.*

To keep that from becoming a surprise at publish time, `EditorWish` now carries
`giftCount` and `raisedNim` (loaded via a `_count` include on the editor
queries), the wishes step shows *🎁 10 NIM received — can't be removed* and
disables Remove, and `reconcileWishes` skips gifted wishes outright so a stale
local draft can't turn publishing into a failure the creator can't act on.

### One validated network, and never a silent one (P0-3)

`lib/env.ts` is now the only place that reads `NIMIQ_NETWORK`:

- `resolveNimiqNetwork()` accepts `mainalbatross` or `testalbatross`, defaults to
  **mainnet** when unset, and **throws** on anything else — naming the variable
  and the valid values.
- `gifts/verification.ts` (`EXPECTED_NETWORK`) and `nimiq/client.ts`
  (`nimiqNetwork()`) both delegate to it, so the chain the worker *watches* and
  the chain verification *accepts* cannot drift apart.
- `env.isTestnet()` is surfaced **from the server** — in the payment intent and
  status payloads, and in the dashboard overview. On testnet the gift dialog
  carries *"Test network. …the NIM sent here is test NIM and has no value"* on
  the amount, hand-off and review steps, and the dashboard says the same above
  the totals. On mainnet none of it renders, so the public page stays free of
  chain talk. A testnet demo can no longer be mistaken for real money.

### Reliability and accessibility

- Gift dialog: Escape is guarded the same way the backdrop is; `role="dialog"`,
  `aria-modal` and the label moved onto the panel, which is focused on open and
  returns focus on close; background scroll locked; sending/verifying and
  confirmed announced via `role="status"`, failures via `role="alert"`; every
  inline error is now announced.
- `Button`: `aria-busy` plus visually-hidden ", working…" while loading, and a
  `focus-visible` ring on all three variants.
- Share: the copy pill gained a real accessible name and a 44px minimum height;
  "Link copied" is announced, not only shown.
- `src/app/error.tsx` — human copy, a Try-again, and Next's `digest` as the only
  reference. No stack, no error code, no database message; the detail goes to
  the server log.
- `src/app/not-found.tsx`, plus `loading.tsx` skeletons for `/b/[slug]` and
  `/dashboard`.
- Publishing with an expired session now says so plainly and returns to the
  Connect step with the draft intact.
- Explicit `viewport` (device-width, zoom left enabled, `viewport-fit: cover`,
  theme colour matching `cream`).

---

## 3. Nimiq Pay — what was actually tested

Stated precisely, because this is the part that is easiest to overstate.

| | |
|---|---|
| **Real device wallet connection** | **Not tested in this phase.** No Nimiq Pay device was available to this pass. |
| **Real signing** | **Not tested in this phase.** |
| **Real NIM payment** | **Not tested in this phase.** No NIM moved, on any network. |
| **Network used** | The local server ran on `testalbatross` (the value in `.env`). No mainnet smoke test was performed. |

**What was exercised instead:** the complete gift path through the **real**
verification and credit code — `createPaymentIntent` → `attachTransaction` →
`verifyTransaction` → `creditGift` → wish progress → dashboard — with a
synthetic transaction supplied by `/api/dev/mock-verify` in place of the
on-chain lookup. That is the same substitution Phase 2 and Phase 3 used. It
proves the rules and the accounting; it does not prove the wallet.

**The three device checks remain open**, exactly as `TESTING.md` records them,
and none of the files behind them were modified in this phase:
`verifySignature.ts` (does approving the signature actually sign you in),
`txResult.ts` (does the wallet return a plain hash), `deepLink.ts` (does Nimiq
Pay preserve the path and query). Track B in `TESTING.md` is the procedure.

---

## 4. Testing

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npm run lint` | ✓ no warnings or errors |
| `npm test` (no database) | ✓ 176 passed, 53 skipped |
| `npm test` (real database) | ✓ **228 passed, 1 skipped** — no failures |
| `npm run build` | ✓ clean, 26 routes (was 25) |
| `npm run e2e:phase3` | ✓ **51/51 checks** (was 35/35) |
| Mobile / device testing | **Not done** — see §3 and §6 |
| Accessibility | Practical pass, not a WCAG audit — see below |

The one skipped test is still the opt-in live-mainnet check (`RUN_MAINNET_TESTS=1`).

### 19 tests added

| File | Covers |
|---|---|
| `tests/db/messages.test.ts` (+7) | creator deletes their own message · another creator gets 403 and the message survives · unauthenticated gets 401 · deleted message leaves the public feed, the creator's list, the activity feed and the count · **a message linked to a confirmed gift is deleted while the `Gift`, `PaymentIntent`, `ProcessedTransaction` and `Wish.raisedLuna` rows are byte-for-byte unchanged and dashboard totals still show the gift** · deleting twice is a clean 404 with nothing internal in it · deleting an anonymous message returns no name and no `NQ` string |
| `tests/db/giftRoutes.test.ts` (+4) | a gifted wish can't be deleted (409), and the wish, gift, intent, guard row and `raisedLuna` all survive the attempt · an ungifted wish still deletes · the editor payload reports `giftCount`/`raisedNim` · 403 for another creator, 401 for no session |
| `tests/lib/network.test.ts` (new, 7) | defaults to mainnet when unset/blank · accepts every supported network · **rejects plausible typos** (`mainnet`, `testnet`, `main-albatross`, wrong case) rather than failing every payment later · the refusal names the variable and the valid values · the verifier, the light client and `isTestnet()` all report the same value |

### The `enforces unique slugs` failure is fixed, not hidden

This had been carried since Phase 2 as "PGlite-over-socket drops the connection
on a constraint violation; passes on real PostgreSQL". That diagnosis was right,
but the failure was avoidable. The *cause* was the preceding test — the one that
deliberately violates the one-NIMday-per-creator constraint — leaving a dead
socket behind, so the *next* test's `beforeEach` cleanup failed.

The two tests that deliberately trigger a constraint violation now go through
`expectRejectedByConstraint()`, which makes the same assertion
(`await expect(write).rejects.toThrow()`) and then calls `$disconnect()` so
Prisma reconnects lazily on the next query. **No assertion was weakened, skipped
or loosened** — the accommodation is for the driver, and on real PostgreSQL it
costs one extra reconnect. The suite is green for the first time.

### Accessibility quick pass

Checked, and fixed where it was wrong: button and link labels (the wish card
carries `aria-label="Send a gift toward …"`; the copy pill names the URL it
copies); form labels on every input in the composer, the wizard and the gift
dialog; keyboard operation of the gift dialog (focus in on open, focus restored
on close, Escape except mid-payment); visible focus rings on all buttons and
fields; feedback never by colour alone (copy success, message sent, message
removed and every error state have a text or live-region equivalent); dialogs
closable; `alt` text present, decorative images marked `aria-hidden`; loading
and disabled buttons announce themselves. Progress bars already carried
`role="progressbar"` with proper values from Phase 3.

Not done: a screen-reader run and a measured contrast audit. Some of the muted
theme text (`theme.muted` on tinted cards) is small and low-contrast by design
and has not been measured against 4.5:1.

---

## 5. Security review

Re-checked against the current code, not against the previous documents.

**Authentication.** Every creator operation resolves the user from the session
cookie via `getCurrentUser()` and nothing else. `/dashboard` and
`/api/birthdays/me/*` query by `creatorId` — there is no id in the URL.
`requireOwnedBirthday` / `requireOwnedWish` compare against the session user;
message deletion compares against the message's own birthday's `creatorId`. **No
client-supplied identifier is trusted for authorization anywhere.**

**Payments.** Unchanged from Phase 2, and re-verified: the recipient is always
derived server-side from the wish's birthday's creator; a submitted hash only
sets `SUBMITTED` and credits nothing; only `state === "confirmed"` credits;
network, recipient, sender, memo and amount are all checked; `Gift.txHash`
uniqueness plus the `ProcessedTransaction` guard make a duplicate credit
impossible; an invalidated transaction reverses and decrements; wish progress
and creator totals read only `CONFIRMED` gifts from the one ledger. The frontend
cannot mark a gift confirmed, alter a total, or move a progress bar. **P0-1 was
the one place where this ledger was reachable — through the wishlist editor —
and it is now closed.**

**Messages.** All content rules run server-side in `createMessage` regardless of
what the composer did; anonymous is enforced at three levels and re-checked
before a gift badge is emitted; deletion is creator-authorized.

**Secrets.** `.env` is git-ignored and untracked (`git ls-files` shows only
`.env.example`). A repository scan for private keys, seed phrases, API keys and
credentials returned three hits, all prose in the documentation saying NIMday
never asks for them. `.env.example` lists every variable the code reads and no
value from the real `.env` appears in any document.

**Configuration.** `ALLOW_DEV_LOGIN` and `/api/dev/mock-verify` both refuse on
`NODE_ENV === "production"` *and* require the flag. `AUTH_SECRET` has no fallback
in production — the process throws. Network configuration is covered in §2.

---

## 6. Known limitations

Genuine, and current.

- **No real Nimiq Pay device testing in this phase.** The three device checks are
  still open. This is the single largest gap between "the code is right" and
  "the product works". See §3.
- **No mobile visual QA on a device.** One rendering of the public page at 390px
  was reviewed; the create flow, dashboard and gift flow were reviewed from
  markup only. The mobile-first structure (single column, `sm:` breakpoints,
  44px tap targets, `dvh` sizing, internally-scrolling dialog) is in the code;
  how it *looks* on a given phone is unverified.
- **P1-10, fixed:** the countdown pill used to wrap to two lines at 390px with
  the trailing `· turning 30` sitting badly against the centred first line.
  Fixed in `src/components/Countdown.tsx` — it is one centred inline text run
  rather than a row of flex items, so the countdown now reflows correctly on
  narrow screens. No longer a limitation.
- **Rate limiting is in-process.** `lib/rateLimit.ts` bounds one server instance
  and resets on deploy; behind multiple instances the effective limit multiplies.
  It stops someone holding down "send"; it is not a defence against a determined
  attacker. `POST /api/gifts/intent` still has none.
- **No moderation, by design.** Content rules reject empty, over-long,
  link-bearing and duplicate messages. Nothing filters abusive text — the creator
  can now remove a message, and that is the whole of it.
- **The public page does not poll.** A visitor reading it won't see messages or
  gifts that arrive while they're there.
- **Local disk image storage.** `STORAGE_DRIVER=local` writes to
  `./storage-uploads` and is not durable on an ephemeral or serverless host. The
  `StorageDriver` abstraction is ready; no S3/R2 driver is implemented.
- Carried over and unchanged: quest progress is per-device; the message feed
  loads 50 with no pagination; a named message can be linked to a gift only once
  and only in the same session; the dashboard loads the whole gift list to derive
  fulfilment moments; one worker with no queue; reconciliation is O(open
  recipients); 30-minute intent expiry; `Wish.raisedLuna` is a cache with no
  periodic re-derivation; one NIMday per wallet.

---

## 7. What is left for a person to do

Everything below needs hands and a phone; none of it can be done from here.

### Release checklist — creator

- [ ] Open NIMday, start creating
- [ ] Enter name, birthday date, message, photo, theme
- [ ] Add a wish (title, amount, gift type)
- [ ] **Connect Nimiq Wallet** inside Nimiq Pay and approve the signature
- [ ] Preview — confirm it matches what a visitor will see
- [ ] Publish, copy the link
- [ ] Open `/dashboard` — countdown, Draft/Published, share block, empty states

### Release checklist — visitor

- [ ] Open the public link **in a normal browser, with no wallet** — the card,
      wishes and composer must all work
- [ ] Leave a named message; leave an anonymous one
- [ ] Tap a wish → choose an amount → **Continue**
- [ ] Outside Nimiq Pay: confirm the "Open in Nimiq Pay" hand-off appears
- [ ] Inside Nimiq Pay: connect, **Confirm & send NIM**, approve
- [ ] Watch it go *submitted → verifying → Gift confirmed 🎁*
      (the worker must be running: `npm run worker`)
- [ ] Wish progress moves; the gift appears in activity

### Release checklist — creator after a gift

- [ ] Dashboard shows the gift, updated progress, updated activity
- [ ] The message appears in **Messages**
- [ ] **Remove** a message → confirm → it disappears from the public page
- [ ] Gift count and NIM total are unchanged after that removal
- [ ] Try to remove the gifted wish — it must refuse, and say why

### Sharing

- [ ] Copy the public URL and open it fresh
- [ ] Open it from WhatsApp on a phone
- [ ] Nimiq Pay deep link: does it land on the same NIMday **and the same gift**

### Before deploying

- [ ] `NIMIQ_NETWORK` — set deliberately. On mainnet, confirm no "Test network"
      notice appears anywhere; on testnet, confirm it appears in the gift dialog
      and on the dashboard.
- [ ] `AUTH_SECRET` — a real 32+ byte secret, not the example.
- [ ] `NEXT_PUBLIC_APP_ORIGIN` — the public origin, no trailing slash. Every
      share link and deep link is built from it.
- [ ] `ALLOW_DEV_LOGIN` and `NEXT_PUBLIC_ALLOW_DEV_WALLET` — **unset**.
- [ ] `DATABASE_URL` — a real PostgreSQL, not PGlite.
- [ ] `npm run worker` running, on the same network. Nothing is credited without it.

`TESTING.md` Track A (desktop, dev wallet, simulated gift) and Track B (phone,
inside Nimiq Pay, real testnet NIM) remain the step-by-step procedures.

---

## 8. Local environment note

The bundled `.pglite` development database was **not** touched. All database
work for this pass ran against a throwaway PGlite instance on port 5434 in the
scratch directory, so nothing local was reset or lost. To reproduce:

```
DEV_DB_PORT=5434 node scripts/dev-db.mjs <a temp dir>
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/postgres?pgbouncer=true&connection_limit=1" npx prisma db push
DATABASE_URL="…5434…" npx vitest run --no-file-parallelism
```

`--no-file-parallelism` is still required: one PGlite instance can't serve
several test files at once.

---

**STATUS: code-complete for release, pending device validation.**

The three P0 defects are fixed and covered by tests. The suite is fully green.
Message deletion is in, authorized on the server, and provably unable to touch a
payment record. What has *not* been established is the half that needs a phone:
no real wallet connection, no real signature, and no real NIM has moved in this
phase, and the product should not be described as end-to-end proven until it has.
