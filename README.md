# nimDay

> Your birthday. Your wishes. One beautiful link.

A digital birthday card that doubles as a gift wishlist, built as a **Nimiq Pay Mini App**.
Create a birthday page, add a few wishes, connect your Nimiq wallet, publish, and share one link.

**Current status: release candidate.** The creator flow, public birthday page,
NIM gifting with backend verification, birthday messages, the Birthday Quest and
the creator dashboard are all in, with 189 passing tests and a clean build.

**Not yet verified:** no Nimiq Pay device has been tested against this build, so
real wallet connection, real signing and real NIM movement are unproven. The
gift path has only been exercised with synthetic transactions through the real
verification and credit code.

> A payment only becomes a gift when the **backend** independently verifies a
> confirmed on-chain transaction. The frontend can never declare success.

## Stack

Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Tailwind CSS ·
`@nimiq/mini-app-sdk` (wallet) · `@nimiq/core` (server-side signature verification).

## Getting started

```sh
npm install
cp .env.example .env          # then edit AUTH_SECRET etc.

# --- database: pick one ---
docker compose up -d db       # A) real Postgres
#   or
npm run db:dev                # B) zero-infra PGlite (see .env.example for the DATABASE_URL flags)

npm run db:push               # apply the schema
npm run db:seed               # optional: a demo nimDay at /b/demo-nimday

npm run dev                   # http://localhost:3000
npm run worker                # in a second shell — the verification worker
```

The **verification worker** is what turns payments into gifts. It holds a long-lived
`@nimiq/core` light client (mainnet consensus, no self-hosted node, no RPC), watches
recipient addresses, and credits only transactions it has verified as `confirmed`.
Nothing is credited without it.

Wallet connection and Sign-In-With-Nimiq only work **inside the Nimiq Pay app**. For local
development without a device, set `ALLOW_DEV_LOGIN=1` and `NEXT_PUBLIC_ALLOW_DEV_WALLET=1` —
the creator flow then offers a "test wallet" that runs the *real* signature-verification path
with a deterministic keypair (never enabled in production).

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` | verification worker (`@nimiq/core` light client) |
| `npm test` | Vitest (unit + route-level flow tests). DB integration tests run when `DATABASE_URL` is set; `RUN_MAINNET_TESTS=1` adds a live Nimiq mainnet check. |
| `npm run e2e:phase3` | Scripted end-to-end pass over HTTP against a running dev server (needs `ALLOW_DEV_LOGIN=1` and a reset database). |
| `npm run typecheck` · `npm run lint` | `tsc --noEmit` · `next lint` |
| `npm run db:dev` | in-process PGlite Postgres over a socket (dev only) |
| `npm run db:push` · `db:seed` | Prisma schema sync · demo data |

## Layout

```
src/
  app/
    page.tsx                landing
    create/                 creator wizard (details → wishes → connect → preview → publish)
    dashboard/              "My nimDay" — overview, gift summary, activity (SSR, session-scoped)
    b/[slug]/               public birthday page (SSR) + opengraph-image + not-found
    api/
      auth/                 nonce · verify · me · logout · dev-login
      birthdays/            create · me · me/gifts · me/dashboard · [id] (patch) · [id]/publish · [id]/wishes
      gifts/intent/         create · [id] (status) · [id]/submit
      messages/             list (?slug=) · create — public, no wallet required
      wishes/[id]/          patch · delete
      dev/mock-verify       dev-only simulated verification
      upload · uploads/[file]
  components/               BirthdayCard · WishList · Countdown · ShareControls
                            public/* (GiftFlow · MessageBoard · BirthdayQuest · Confetti)
                            create/* · dashboard/*
  lib/
    money.ts                   NIM ⇄ Luna, integer-only (never floats)
    messages/text.ts           ← pure message rules (length, links, attribution)
    messages/store.ts          message reads/writes + the anonymity rules
    quest.ts                   Birthday Quest — derived, per-device, no table
    share.ts                   ← the one place that builds the public /b/<slug> URL
    dashboard.ts               creator dashboard, built from the verified gift ledger
    activityText.ts            activity-feed copy (pure)
    rateLimit.ts               in-process limiter for the public message endpoint
    gifts/failureCopy.ts       human copy for every verification outcome
    gifts/verification.ts      ← pure transaction-verification rules
    gifts/credit.ts            atomic, idempotent credit + reversal
    gifts/process.ts           verify → credit → status transitions
    gifts/intent.ts            payment intents (recipient derived server-side)
    gifts/shortId.ts           compact "nimday:<id>" memo
    nimiq/client.ts            @nimiq/core light client (worker only)
    nimiq/txResult.ts          ← the one place that parses sendBasicTransactionWithData()
    nimiq/verifySignature.ts   ← the one place that knows sign()'s byte encoding
    nimiq/deepLink.ts          ← the one place that builds Nimiq Pay deep links
    nimiq/provider.ts          client wallet wrapper (typed errors)
    auth/                      jose session cookie · nonce store · currentUser
    birthday.ts                DTOs, ownership guards, publish rules
    storage/                   image storage abstraction (local driver)
worker/index.ts                always-on verification worker
prisma/schema.prisma           User · Birthday · Wish · AuthNonce
                               PaymentIntent · Gift · ProcessedTransaction · WorkerCheckpoint
```

## Security notes

No private keys, seed phrases, or wallet passwords are ever requested or stored. Sessions are
signed httpOnly cookies. Every mutation is authorised against the session's wallet address —
creator IDs from the browser are never trusted. Auth nonces are single-use and expire.
Secrets live only in the environment.

## License

The code is released under the [MIT License](LICENSE).

The sample photos in `public/sample/` are from [Pexels](https://www.pexels.com) and are
used under the [Pexels License](https://www.pexels.com/license/). They are not covered by the
MIT License.
