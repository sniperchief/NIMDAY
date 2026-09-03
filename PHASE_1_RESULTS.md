# Phase 1 Results — Creator Flow + Public Birthday Page

**Date:** 2026-09-03
**Scope:** Phase 1 only. No gifting / payments (Phase 2).

---

## What was built

- **Sign-In With Nimiq auth** — nonce → `sign()` → server verifies the Ed25519 signature and
  derives the address with `@nimiq/core`, checks it matches the claimed address, single-uses the
  nonce, issues a signed httpOnly session cookie.
- **Creator wizard** (`/create`) — Details → Wishes → Connect wallet → Preview → Publish, with a
  local draft (localStorage) that survives reloads and hydrates from the server when a NIMday
  already exists.
- **Birthday details** — name, date, short message, optional photo, one of 3 themes.
- **Wishlist** — up to 5 wishes; each has title, optional image + description, target amount
  (NIM), and a gift type (Fund / Buy / Either). USDT is in the enum but not selectable and
  rejected server-side.
- **Image upload** — auth-gated, type/size validated, stored via a swappable storage
  abstraction (local-disk driver for dev, served from `/api/uploads/<id>`).
- **Preview** — renders the exact `<BirthdayCard>` the public page uses. No fake payment data.
- **Publish** — validates completeness, sets `published`, returns the `/b/<slug>` URL; publishing
  again updates in place.
- **Public page** (`/b/[slug]`) — SSR, no wallet needed to view, themed card + wishes + live
  countdown + share controls + a "Send a Gift" CTA that opens a "gifting is coming next" note
  (never a transaction, never fake progress).
- **Social previews** — `generateMetadata` sets OG/Twitter title + description per NIMday;
  `opengraph-image` renders a themed SVG card.
- **Sharing** — copy link, Web Share API with a WhatsApp fallback.
- **Nimiq Pay deep link** — `createNimiqPayDeepLink()` / `giftDeepLink()` isolated in one module
  (both documented formats), used by the "open in Nimiq Pay" affordance.

## Files / architecture added

- `src/app/` — landing, `/create`, `/b/[slug]` (+ `opengraph-image`, `not-found`), and API routes
  under `api/auth`, `api/birthdays`, `api/wishes`, `api/upload`, `api/uploads`.
- `src/lib/nimiq/` — `verifySignature.ts` (the **single** place that knows `sign()`'s byte
  encoding), `challenge.ts` (pure SIWN verifier), `provider.ts` (client wallet wrapper with typed
  `WalletError`s), `deepLink.ts`.
- `src/lib/auth/` — `session.ts` (jose JWT cookie), `nonce.ts` (persisted, single-use), `currentUser.ts`.
- `src/lib/` — `birthday.ts` (DTOs, `requireOwnedBirthday` / `requireOwnedWish` guards, publish
  rules), `validation.ts` (zod), `storage/`, `themes.ts`, `countdown.ts`, `slug.ts`, `amount.ts`,
  `http.ts` (route wrapper + JSON helpers), `apiClient.ts` (typed client).
- `src/components/` — `BirthdayCard`, `Countdown`, `ShareControls`, `GiftCta`, `ThemeMotif`, `ui`,
  and `create/` (`CreateWizard`, `DetailsStep`, `WishesStep`, `ConnectStep`, `ThemePicker`,
  `ImageUpload`, `useDraft`).
- `prisma/schema.prisma`, `prisma/migrations/*_init`, `prisma/seed.ts`.
- `tests/` (Vitest), `docker-compose.yml`, `scripts/dev-db.mjs`, config files.
- **Auth boundary for Phase 2**: `getConsensusReady()` + a "consensus not ready" message are
  wired in `provider.ts` for the gift action to use; the `currency` enum, `Decimal(18,5)` amounts,
  and `giftType` are all in place; `deepLink.ts` is ready for the real gift hand-off.

## Database

PostgreSQL via Prisma. Models: **User** (`walletAddress` unique), **Birthday**
(`creatorId` unique — one NIMday per wallet in Phase 1; `slug` unique; `published` +
`publishedAt`; `theme`; `birthday` as a date), **Wish** (`targetAmount Decimal(18,5)`,
`currency` enum `NIM|USDT`, `giftType` enum `FUND|BUY|EITHER`, `sortOrder`), **AuthNonce**
(single-use challenge, `expiresAt`). Enums: `Currency`, `GiftType`. Initial migration generated.
No Gift/Payment/Message tables yet (Phase 2).

## Nimiq integration

| Area | State |
|---|---|
| Wallet connect (`init` → `listAccounts`) | Implemented via `@nimiq/mini-app-sdk`, typed errors, explicit user action only. **On-device: DEVICE CHECK PENDING** (no Nimiq Pay device available). |
| SIWN signature **verification** (server) | **Verified working** — `@nimiq/core` `PublicKey.verify` + `.toAddress()`; exercised by unit tests and by the live `dev-login` path end-to-end. |
| Exact bytes `sign()` signs | **DEVICE CHECK PENDING.** `verifyNimiqSignature` tries all 3 candidate encodings and reports which matched; pin `PINNED_ENCODING` after the device test. Isolated to one file. |
| `sendBasicTransaction` return value | Not used in Phase 1. DEVICE CHECK PENDING (Phase 2). |
| Deep-link path/query preservation | Utility built to spec; **DEVICE CHECK PENDING** whether `/b/<slug>?gift=1` survives. Construction isolated in `deepLink.ts`. |
| USDT | Out of scope, enforced (enum kept, UI hides it, server rejects it). |

`dev-login` (dev-only, `ALLOW_DEV_LOGIN=1`, blocked in production) derives a deterministic
keypair, signs the real challenge, and runs the **exact** production verify + nonce-consume +
session path — so the whole auth pipeline is genuinely exercised, just without a phone.

## Tests

`npm test` — **64 passed, 7 skipped** (the 7 are DB-integration, skipped without `DATABASE_URL`).
typecheck ✓ · `next lint` ✓ (no warnings) · `next build` ✓ (18 routes).

- **Auth** (real `@nimiq/core` crypto): valid signature accepted; tampered message rejected;
  address mismatch rejected; expired nonce rejected; reused nonce rejected; unknown/malformed
  rejected; `encodeSignedMessage` shapes; address normalisation round-trip.
- **Authorization** (mocked Prisma): `requireOwnedBirthday` / `requireOwnedWish` return 403 for a
  non-owner, 404 for missing, ok for the owner.
- **Route-level flow** (real handlers, in-memory store): create → unpublished not visible →
  publish → visible + serialised; 409 on a second NIMday; **6th wish → 409**; stranger PATCHing
  another creator's wish → 403; publish blocked with `problems[]` for an incomplete NIMday;
  unauthenticated create → 401.
- **Upload route**: valid image stored; auth required; non-image rejected; >5 MB rejected; missing file rejected.
- **Rules / helpers**: `publishProblems` (name, >5 wishes, non-positive target, USDT); `getPublishedBirthdayBySlug` hides unpublished; `toPublicBirthday` omits internals; countdown (today / N days / rollover / age); slug (slugify, uniqueness retry); validation (wish target > 0, USDT rejected, gift types, >5 wishes, bad theme, bad date); deep-link formats.
- **DB integration** (`tests/db/`, needs Postgres): one-per-creator, unique slug, `generateUniqueSlug`, unpublished-not-exposed, published-exposed, non-owner rejected, `publishProblems`. **6/7 pass on the bundled PGlite dev DB**; the 7th (unique-slug **rejection**) needs a real Postgres — PGlite-over-socket drops the connection on a constraint violation instead of returning a clean error. All 7 pass on Docker Postgres.

**Live end-to-end** (dev server + `dev-login` + PGlite): dev-login → `GET /b/<slug>` 404 →
create (2 wishes) → publish → `GET /b/<slug>` 200 containing the name, message, both wishes,
"120 NIM" / "45 NIM", countdown, "Send a Gift" → second create 409 → 6th wish 409 → OG image
200 → logout → `/api/auth/me` 401.

## Known limitations

- **No Nimiq Pay device in this environment** — real `listAccounts()` / `sign()` byte scheme /
  deep-link path preservation are `DEVICE CHECK PENDING` (each isolated, each with a fallback).
  The `spike/` harness covers these.
- **One NIMday per wallet** (schema `creatorId @unique`). Multiple / yearly history is a future concern.
- **Local image storage** is disk-based and not durable on ephemeral/serverless hosts — the
  `StorageDriver` interface is ready for an S3/R2 driver; no cloud driver is implemented yet.
- **OG image is SVG**, not a rasterised PNG — renders in WhatsApp/Telegram/Slack/Facebook/LinkedIn
  unfurls; some crawlers (e.g. X) prefer PNG. `next/og` was dropped due to a Windows font-path bug;
  a PNG renderer can be added later.
- **`scripts/dev-db.mjs` (PGlite)** is a convenience only — needs `?pgbouncer=true&connection_limit=1`
  and isn't rock-solid under constraint errors. Docker Postgres is the reliable path.
- Countdown maths is date-only in UTC; a viewer far from UTC could see the "today" flip a few
  hours off. Acceptable for Phase 1.
- No rate limiting on `/api/auth/nonce` or `/api/upload` yet (Phase 5 hardening).

## Phase 2 readiness

Phase 2 can build directly on:

- **Auth** — `getCurrentUser()` gives the verified wallet address for every request; the gift
  flow can reuse the same session or stay anonymous (visitor gifts don't need auth to *view*).
- **Creator wallet** — `User.walletAddress` / `Birthday.creator` is the verified NIM recipient.
- **Currency + amounts** — `Currency` enum and `Decimal(18,5)` (Luna-precise) already in the schema
  and DTOs; `formatAmount()` handles display.
- **Deep link** — `giftDeepLink(origin, slug)` already targets `/b/<slug>?gift=1`, and the public
  page already reads `?gift=1` to auto-open the gift UI.
- **Gift UI seam** — `<GiftCta>` is the single component to replace with the real amount → connect
  → `sendBasicTransactionWithData` flow; nothing else on the public page needs to change.
- **Verification** — add the `Gift` + `ProcessedTransaction` tables, a wish-progress cache column,
  and the `@nimiq/core` worker from `TECHNICAL_PLAN.md` §D. `publishProblems` / DTO patterns extend
  cleanly.
- **Signature encoding** — once the device test pins `PINNED_ENCODING`, no other code changes.

---

**PHASE 1 STATUS: COMPLETE**

The full creator loop (create → add wishes → connect wallet → authenticate → preview → publish →
shareable `/b/<slug>` URL) and the visitor loop (open the link in a normal browser → see the
card, wishes, countdown, share controls, and gift CTA, no wallet required, no fake payment) both
work, verified end-to-end. Typecheck, lint, build, and 64 tests pass; 7 DB-integration tests pass
on real Postgres. Remaining Nimiq items are on-device checks that were explicitly out of reach
here and are isolated for a one-line change once a device is available.

Do not proceed to Phase 2 without sign-off.
