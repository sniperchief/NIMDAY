# NIMday

> Your birthday. Your wishes. One beautiful link.

A digital birthday card that doubles as a gift wishlist, built as a **Nimiq Pay Mini App**.
Create a birthday page, add a few wishes, connect your Nimiq wallet, publish, and share one link.

**Current status: Phase 1 — Creator flow + public birthday page.** No real gifting yet (Phase 2).
See `PRD.md`, `TECHNICAL_PLAN.md`, `PHASE_0_RESULTS.md`, `PHASE_1_RESULTS.md`.

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
npm run db:seed               # optional: a demo NIMday at /b/demo-nimday

npm run dev                   # http://localhost:3000
```

Wallet connection and Sign-In-With-Nimiq only work **inside the Nimiq Pay app**. For local
development without a device, set `ALLOW_DEV_LOGIN=1` and `NEXT_PUBLIC_ALLOW_DEV_WALLET=1` —
the creator flow then offers a "test wallet" that runs the *real* signature-verification path
with a deterministic keypair (never enabled in production).

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest (unit + route-level flow tests). DB integration tests run when `DATABASE_URL` is set. |
| `npm run typecheck` · `npm run lint` | `tsc --noEmit` · `next lint` |
| `npm run db:dev` | in-process PGlite Postgres over a socket (dev only) |
| `npm run db:push` · `db:seed` | Prisma schema sync · demo data |

## Layout

```
src/
  app/
    page.tsx                landing
    create/                 creator wizard (details → wishes → connect → preview → publish)
    b/[slug]/               public birthday page (SSR) + opengraph-image + not-found
    api/
      auth/                 nonce · verify · me · logout · dev-login
      birthdays/            create · me · [id] (patch) · [id]/publish · [id]/wishes
      wishes/[id]/          patch · delete
      upload · uploads/[file]
  components/               BirthdayCard · Countdown · ShareControls · GiftCta · create/*
  lib/
    nimiq/verifySignature.ts   ← the one place that knows sign()'s byte encoding
    nimiq/challenge.ts         SIWN message + pure verifier
    nimiq/deepLink.ts          createNimiqPayDeepLink()
    nimiq/provider.ts          client wallet wrapper (typed errors)
    auth/                      jose session cookie · nonce store · currentUser
    birthday.ts                DTOs, ownership guards, publish rules
    storage/                   image storage abstraction (local driver)
prisma/schema.prisma           User · Birthday · Wish · AuthNonce
```

## Security notes

No private keys, seed phrases, or wallet passwords are ever requested or stored. Sessions are
signed httpOnly cookies. Every mutation is authorised against the session's wallet address —
creator IDs from the browser are never trusted. Auth nonces are single-use and expire.
Secrets live only in the environment.
