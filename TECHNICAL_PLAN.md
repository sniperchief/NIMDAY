# NIMday — Technical Implementation Plan

**Status:** Research complete. No application code written yet.
**Date:** 2026-09-02
**Source of truth:** Official Nimiq documentation (`nimiq.dev`), the `@nimiq/mini-app-sdk` package types, and `@nimiq/core` web client. Every Nimiq API named below was checked against those. Where the docs are silent or contradictory, it is flagged rather than guessed.

---

## 0. What the research established (facts, not assumptions)

### 0.1 The Mini App SDK is tiny

`@nimiq/mini-app-sdk` (latest published: **0.1.0**) exports only three things:

| Export | Signature | Purpose |
|---|---|---|
| `init()` | `() => Promise<NimiqProvider>` | Waits for Nimiq Pay to inject the provider, returns a typed `NimiqProvider`. |
| `getHostLanguage()` | `() => string` | Mirrors `window.nimiqPay.language` (ISO 639-1, e.g. `'en'`). |
| `requestDeviceIdentifier({ reason })` | `=> Promise<string>` | 64-char hex SHA-256, **scoped to device, not user**. Stable across reinstalls/accounts. Not an identity primitive. |

Everything else comes from the **injected provider objects**: `window.nimiq` (via `init()`) and `window.ethereum`.

### 0.2 `NimiqProvider` methods (from `dist/provider.d.ts`)

```
listAccounts(): Promise<string[] | ErrorResponse>              // requires user confirmation
sign(message: string | { message: string; isHex?: boolean })
    : Promise<{ publicKey: string; signature: string } | ErrorResponse>   // hex; requires confirmation
isConsensusEstablished(): Promise<boolean>                     // no confirmation
getBlockNumber(): Promise<number>                              // no confirmation
sendBasicTransaction({ recipient, value, fee?, validityStartHeight? }): Promise<string | ErrorResponse>
sendBasicTransactionWithData({ recipient, value, data, fee?, validityStartHeight? }): Promise<string | ErrorResponse>
// + staking methods (sendNewStakerTransaction, sendStakeTransaction, ...) — not used by NIMday
request<T>(args): Promise<T>                                   // generic JSON-RPC passthrough
```

- `value` / `fee` are in **Luna**. `1 NIM = 100_000 Luna` (5 decimals).
- The provider **sends** the transaction itself (sign + broadcast in one step). NIMday never touches a key.
- The API-reference page says `sendBasicTransaction` **returns the transaction hash** (`string`). The bundled JSDoc string says "the serialized transaction". Treat as **hash**, but the Phase 0 spike must confirm what the string actually is. (See Risk R4.)
- There is a `TransactionInfo` **type** exported, but **no method that returns it**. The provider has **no transaction-lookup and no event/listener API**. Confirmation must be obtained by NIMday's own infrastructure.
- Errors surface either as thrown `PermissionDeniedError` / `InvalidTransactionError`, or as a returned `{ error: { type, message } }`. Handle both.

### 0.3 `window.ethereum` (EIP-1193 + EIP-6963)

Methods confirmed in docs: `eth_requestAccounts`, `eth_sendTransaction`, `eth_getTransactionReceipt`, `eth_getBalance`, `eth_chainId`, `wallet_switchEthereumChain`. Standard JSON-RPC reads (`eth_getTransactionByHash`, `eth_blockNumber`, `eth_call`) are expected to pass through but must be confirmed in the spike.

**Chains currently exposed by Nimiq Pay to mini apps:** Ethereum Mainnet, Arbitrum One, Optimism, Base, BNB Smart Chain, Sepolia.
**Polygon is _not_ in that list.** The docs note more chains "can be added over time via configuration updates."

### 0.4 The USDT problem (critical)

- The **Nimiq Pay wallet** natively holds **USDT on Polygon** (`0xc2132D05D31c914a87C6611C10748AEb04B58e8F`, 6 decimals) with gas abstraction (users don't need POL).
- The **mini-app Ethereum provider does not currently expose Polygon.**
- Therefore, today, a mini app most likely **cannot move the USDT balance a Nimiq Pay user actually has.** The chains it *can* reach are ones where a typical Nimiq Pay user holds nothing.

This is unresolved in the public docs and must be answered by the Nimiq team before any USDT work. See **Risk R1**. It does **not** block the NIM MVP.

### 0.5 Verifying NIM transactions — no public infrastructure is handed to you

- The mini-app provider gives you no lookup. You must verify server-side using one of:
  1. **`@nimiq/core` web client running in Node.js** (recommended). Rust→WASM light client, builds P2P consensus with no self-hosted node, exposes `client.getTransaction(hash)` returning transaction details with a `state` that progresses `new → pending → included → confirmed` and a `confirmations` count (`CONFIRMED` default = 10 confirmations; Nimiq PoS block time ≈ 1 s, so ≈ seconds, not minutes).
  2. A **self-hosted Albatross RPC node** + `getTransactionByHash`. Operationally heavier.
  3. Typed RPC wrappers (`nimiq-rpc-client-ts` / `onmax/albatross-rpc-client-ts`) pointed at your own node.
- There is a **public _testnet_ RPC** (`https://rpc.nimiq-testnet.com`). There is **no official public _mainnet_ RPC** endpoint — so option 1 is the path of least resistance for production.

---

## 1. Nimiq Pay Mini App initialization & wallet connection

```ts
import { init, getHostLanguage } from '@nimiq/mini-app-sdk'

// App boot (only meaningful inside the Nimiq Pay WebView)
const nimiq = await init()               // resolves once window.nimiq is present
const locale = getHostLanguage()         // 'en' | 'de' | ...

// Connect (explicit user action — button press, never on load)
const accounts = await nimiq.listAccounts()   // native confirmation dialog
if ('error' in accounts) handleRejection(accounts.error)
const address = accounts[0]                    // 'NQ.. ....' human-readable IBAN-style
```

- **Detect environment first.** `window.nimiq` / `window.nimiqPay` only exist inside Nimiq Pay. Outside it (a normal browser opening a shared link), render the read-only card and a "gift" CTA that routes the visitor into Nimiq Pay (see Risk R6 — this flow needs a Nimiq-supplied deep link).
- `isConsensusEstablished()` should gate the gifting UI ("Connecting to Nimiq…") so a transaction isn't attempted before the in-app client is ready.
- Never request accounts on page load; only when the creator publishes or a visitor chooses to gift (matches PRD §19).

---

## 2. Identifying the birthday creator's Nimiq wallet

- The creator's receiving address = `listAccounts()[0]` captured **at publish time**, inside Nimiq Pay.
- Store it on the `Birthday` row as `creatorAddress` (and on `User.address`). This is the **only** payment target; it is written server-side from a verified signed session, never from a form field.
- Publishing is **blocked** until `creatorAddress` is set (PRD §19).
- If a creator wants to change their receiving address later, require a fresh signature from the new address and re-verify; keep it append-only for audit (old gifts stay attributed to the address that received them).
- Nimiq addresses have a checksum; validate format server-side before storing.

---

## 3. Sending a NIM gift directly from visitor → creator

Flow is **wallet-to-wallet**; NIMday only records intent and verifies the result.

```ts
// 1. Backend: create a GiftIntent, return { intentId, recipient, valueLuna, memo }
//    memo = `nimday:${shortNonce}`  (a per-intent random token)

// 2. Frontend (inside Nimiq Pay):
const txHash = await nimiq.sendBasicTransactionWithData({
  recipient: intent.recipient,      // creator address
  value: intent.valueLuna,          // NIM * 100_000, integer
  data: intent.memo,                // ties the on-chain tx to this intent
})
if (typeof txHash !== 'string') handle(txHash.error)

// 3. Frontend: POST { intentId, txHash } to backend → status "submitted"
// 4. Backend verification worker takes over (section 4)
```

- **Use `sendBasicTransactionWithData`, not `sendBasicTransaction`**, so the memo disambiguates two visitors gifting the same amount to the same creator. Confirm the max `data` size in the spike (Nimiq basic-transaction extra data has historically been capped at **64 bytes**; `nimday:` + a short nonce fits comfortably).
- Fee: let the wallet default it (omit `fee`). Don't set `validityStartHeight` unless the spike shows it's required.
- Amount policy (PRD §8 "correct amount" is ambiguous for a contribution model): **accept any value > 0**, credit the actual on-chain value toward progress, and never require paying the exact remaining balance (PRD §10). Reject `value <= 0` client- and server-side.

---

## 4. Obtaining & verifying NIM transactions after payment

**Verification service:** a small long-running Node process holding one warm `@nimiq/core` client (consensus stays established). The Next.js app enqueues `{ intentId, txHash }`; the worker polls.

Per PRD §8, a gift counts **only** when all of these hold:

| Check | How |
|---|---|
| Transaction exists | `client.getTransaction(txHash)` returns a record |
| Correct network | `networkId` == Nimiq mainnet |
| Correct currency | It's a NIM basic transaction (not staking/HTLC) |
| Correct recipient | `tx.to` == `birthday.creatorAddress` |
| Correct amount | `tx.value` == `intent.valueLuna` (and/or `>= expected`); credit `tx.value` |
| Memo match | `tx.data` decodes to `intent.memo` |
| Confirmed | `state == 'confirmed'` (≥ N confirmations; start with the client default, 10) |
| Not already used | `txHash` absent from `processed_transactions` (unique index) |
| Sender captured | `tx.from` recorded as `Gift.senderAddress` (server-derived, never trusted from client) |

On success, in **one DB transaction**: insert `processed_transactions(txHash)` → insert/settle `Gift` as `verified` → recompute `wish.raised` = SUM(verified gift values for that wish, that currency) → append activity row.

- **Timeout:** if not `confirmed` within e.g. 30 min, mark the intent `expired` (the tx may still land later — a reconciliation sweep can pick up an orphaned intent whose memo/recipient/amount match).
- **Reorg safety:** only credit at `confirmed`; if a previously credited tx later reports `invalidated`, reverse the credit and flag.
- **Idempotency:** the worker must be safe to run repeatedly on the same intent.

---

## 5. USDT via the Nimiq Pay Ethereum provider

> **Do not build this until Risk R1 is resolved.** The design below is the shape it would take *if* Nimiq exposes a chain on which Nimiq Pay users hold USDT.

```ts
const [from] = await window.ethereum.request({ method: 'eth_requestAccounts' })
const chainId = await window.ethereum.request({ method: 'eth_chainId' })
// abort unless chainId is the Nimiq-approved stablecoin chain

// ERC-20 transfer(address,uint256), amount in token base units (USDT = 6 decimals)
const data = '0xa9059cbb'
  + recipient.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  + amountBaseUnits.toString(16).padStart(64, '0')

const txHash = await window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [{ from, to: USDT_CONTRACT, value: '0x0', data }],
})
```

- **Token address & chain:** take from a Nimiq-supplied configuration or the provider's advertised config at runtime. **Do not hardcode** (PRD §7). The Polygon USDT address above is documented only as the *wallet's* config, not the mini-app provider's.
- **Gas:** rely on Nimiq's gas abstraction if the approved chain is Polygon; otherwise the user needs the native gas token, which breaks the "not a crypto app" promise — another reason R1 matters.
- The creator's EVM receiving address is a **separate value** from their NIM address. Capture it with `eth_requestAccounts` at publish time only if USDT is enabled; store as `Birthday.creatorEvmAddress`.

---

## 6. Currently supported network / token configuration for USDT

| Item | Finding |
|---|---|
| Nimiq Pay **wallet** USDT | USDT on **Polygon**, contract `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`, 6 decimals, gas-abstracted |
| Mini-app **Ethereum provider** chains | Ethereum Mainnet, Arbitrum One, Optimism, Base, BNB Smart Chain, Sepolia — **Polygon not exposed** |
| Conclusion | **No confirmed, documented path** for a mini app to send the USDT a Nimiq Pay user holds. Must be confirmed with Nimiq. |

**Recommendation:** build a `currency` abstraction (`NIM` | `USDT`) end-to-end now, but ship the MVP **NIM-only** with USDT behind a server-side feature flag that also checks the live provider chain list. This fully satisfies PRD §7 ("secondary payment option", "use the configuration currently supported") without guessing.

---

## 7. Verifying USDT transactions

Same gate as NIM (PRD §8), via `window.ethereum` reads on the frontend *or* a backend EVM RPC (preferred — don't trust the client):

| Check | How |
|---|---|
| Exists / confirmed | `eth_getTransactionReceipt(txHash)` → non-null, `status == '0x1'` |
| Correct network | `receipt`/tx `chainId` == approved chain; or verify against a pinned RPC for that chain |
| Correct recipient & amount | Parse the `Transfer(address,address,uint256)` log: `topics[0]` == `keccak256("Transfer(address,address,uint256)")`, `topics[2]` == creator EVM address (padded), `data` == amount; and `log.address` == approved token contract |
| Correct currency | `log.address` is the approved USDT contract (not just any ERC-20) |
| Confirmed | `eth_blockNumber - receipt.blockNumber >= N` (chain-appropriate, e.g. 20+ on an L2, more on BNB) |
| Not already used | `txHash` unique in `processed_transactions` |
| Sender | `receipt.from` |

Backend needs a read-only RPC URL for whichever chain Nimiq approves (Alchemy/Infura/Ankr/public). Keep it in server env, never in the client.

---

## 8. Creator authentication (so nobody can edit another person's NIMday)

**No passwords, no email, no seed phrases** (PRD §19/§20). Use **Sign-In With Nimiq** (challenge–response):

1. Client: `POST /auth/nonce { address }` → server stores `{ nonce, address, expiresAt }`, returns `nonce`.
2. Client: `const { publicKey, signature } = await nimiq.sign(\`NIMday login\n${nonce}\`)`.
3. Client: `POST /auth/verify { address, publicKey, signature }`.
4. Server:
   - the public key hashes to `address` (Nimiq address = Blake2b→first 20 bytes of the Ed25519 public key, base32 + checksum) — verify with `@nimiq/core` primitives;
   - the Ed25519 `signature` is valid over the exact challenge string;
   - the `nonce` is unused and unexpired → burn it.
5. Server issues a session: JWT in an **httpOnly, Secure, SameSite** cookie (or a server session row). Subject = the Nimiq address.

**Authorization:** every mutating `Birthday`/`Wish`/`Message-moderation` route checks `session.address == birthday.creatorAddress`. A `Birthday` is owned by exactly one address.

**Notes / caveats:**
- Confirm in the spike that `sign()` returns a signature that `@nimiq/core` can verify and that the returned `publicKey` corresponds to the same account as `listAccounts()[0]`. (Nimiq accounts can in principle hold multiple addresses — pin the app to `listAccounts()[0]` and store exactly that.)
- Do **not** use `requestDeviceIdentifier()` for identity — it's per-device, not per-user, and survives account switches.
- Re-auth on cookie expiry is a single `sign()` tap — cheap. Keep sessions short (e.g. 7 days) with sliding renewal.

---

## 9. Recommended frontend / backend architecture

```
                        ┌───────────────────────────────────────────┐
                        │  Nimiq Pay app (WebView)                   │
   shared link ───────► │  ├─ window.nimiq   (NimiqProvider)         │
   (WhatsApp, etc.)     │  └─ window.ethereum (EIP-1193)             │
        │               └───────────────────────────────────────────┘
        │                                  │  HTTPS
        ▼                                  ▼
┌──────────────────┐          ┌──────────────────────────────┐
│ Next.js (Vercel) │          │ Next.js API routes / Route    │
│  • SSR public    │◄────────►│ Handlers                      │
│    card page     │          │  • auth (SIWN)                │
│    (+ OG tags)   │          │  • CRUD birthday/wish/message │
│  • creator flow  │          │  • gift intents               │
│  • gift flow     │          │  • activity / progress reads  │
└──────────────────┘          └───────────────┬───────────────┘
                                              │ enqueue { intentId, txHash }
                                              ▼
                              ┌──────────────────────────────┐
                              │ Verification worker (Railway/ │
                              │ Fly/Render — persistent Node) │
                              │  • warm @nimiq/core client    │
                              │  • EVM RPC client (USDT, later)│
                              │  • poll → verify → credit     │
                              │  • reconciliation sweep (cron) │
                              └───────────────┬───────────────┘
                                              ▼
                          ┌──────────────┐  ┌──────────────────┐
                          │ PostgreSQL   │  │ Object storage    │
                          │ (Neon/Supa)  │  │ (R2/S3) — images  │
                          └──────────────┘  └──────────────────┘
```

**Why this shape:**
- **Next.js (App Router)**: the public birthday card must server-render for fast mobile load and correct Open Graph / Twitter meta tags so WhatsApp/Telegram link previews look like a birthday card (PRD §16). Creator and gift flows are client components that load the mini-app SDK.
- **Separate worker**: the `@nimiq/core` light client needs a long-lived process to keep consensus warm; serverless functions cold-start and can't. One tiny always-on Node service. Everything else stays serverless.
- **No smart contracts, no custody, no key material anywhere in the stack** (PRD §20/§26).

---

## 10. Recommended database & data model

**PostgreSQL + Prisma.** (Supabase if you also want its Storage + row-level auth; Neon if you just want Postgres.)

```prisma
model User {
  id          String   @id @default(cuid())
  address     String   @unique          // Nimiq address, canonical identity
  evmAddress  String?                    // set only if USDT enabled
  createdAt   DateTime @default(now())
  birthdays   Birthday[]
}

model Birthday {
  id               String   @id @default(cuid())
  slug             String   @unique      // public link: /b/{slug}
  creator          User     @relation(fields: [creatorAddress], references: [address])
  creatorAddress   String
  creatorEvmAddress String?
  name             String
  birthdayMonth    Int                    // 1-12  (store M/D, not a full date)
  birthdayDay      Int                    // 1-31
  birthYear        Int?                   // optional, for age/countdown only
  message          String?
  theme            String                 // enum-ish, small fixed set
  photoUrl         String?
  published        Boolean  @default(false)
  publishedAt      DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  wishes           Wish[]
  messages         Message[]
  gifts            Gift[]
  activity         Activity[]
}

model Wish {
  id           String   @id @default(cuid())
  birthday     Birthday @relation(fields: [birthdayId], references: [id])
  birthdayId   String
  title        String
  imageUrl     String?
  description  String?
  targetAmount Decimal                    // in the wish currency's main unit
  currency     Currency                   // NIM | USDT
  giftType     GiftType                   // FUND | BUY | EITHER
  raised       Decimal  @default(0)       // cache: SUM(verified gifts), recomputed on credit
  fulfilledAt  DateTime?
  position     Int                        // 1..5 ordering
  createdAt    DateTime @default(now())
  gifts        Gift[]
  @@index([birthdayId])
}

model GiftIntent {
  id             String   @id @default(cuid())
  wish           Wish     @relation(fields: [wishId], references: [id])
  wishId         String
  birthdayId     String
  currency       Currency
  expectedAmount Decimal
  recipient      String                   // creator address at intent time
  memo           String   @unique         // "nimday:<nonce>"
  anonymous      Boolean  @default(false)
  giverAddress   String?                  // if known before send (optional)
  status         IntentStatus @default(PENDING)  // PENDING|SUBMITTED|VERIFIED|EXPIRED|FAILED
  txHash         String?
  createdAt      DateTime @default(now())
  expiresAt      DateTime
  @@index([status])
}

model Gift {
  id             String   @id @default(cuid())
  wish           Wish     @relation(fields: [wishId], references: [id])
  wishId         String
  birthday       Birthday @relation(fields: [birthdayId], references: [id])
  birthdayId     String
  intentId       String?
  senderAddress  String                   // from verified tx; stored even if anonymous
  amount         Decimal
  currency       Currency
  txHash         String   @unique         // hard dedupe
  anonymous      Boolean  @default(false)
  verifiedAt     DateTime
  createdAt      DateTime @default(now())
  @@index([wishId])
  @@index([birthdayId])
}

model ProcessedTransaction {
  txHash    String   @id                  // ledger of every credited tx, any currency
  chain     String                        // "nimiq" | "polygon" | ...
  creditedAt DateTime @default(now())
}

model Message {
  id          String   @id @default(cuid())
  birthday    Birthday @relation(fields: [birthdayId], references: [id])
  birthdayId  String
  senderAddress String?                   // null when written without connecting
  displayName String?
  body        String                      // length-capped, sanitized
  anonymous   Boolean  @default(false)
  visibility  Visibility @default(PUBLIC) // PUBLIC | (creator-only not in MVP)
  hidden      Boolean  @default(false)    // creator moderation
  createdAt   DateTime @default(now())
  @@index([birthdayId])
}

model Activity {
  id          String   @id @default(cuid())
  birthday    Birthday @relation(fields: [birthdayId], references: [id])
  birthdayId  String
  kind        String                      // "gift" | "message"
  amount      Decimal?
  currency    Currency?
  wishTitle   String?
  anonymous   Boolean  @default(false)
  actorLabel  String?                     // "David" or null → "Someone"
  createdAt   DateTime @default(now())
  @@index([birthdayId, createdAt])
}

enum Currency { NIM USDT }
enum GiftType { FUND BUY EITHER }
enum IntentStatus { PENDING SUBMITTED VERIFIED EXPIRED FAILED }
enum Visibility { PUBLIC }
```

Design notes:
- `ProcessedTransaction` + `Gift.txHash @unique` = two independent guards against double-crediting (PRD §20).
- Money stored as `Decimal` in the currency's main unit; convert to Luna/base-units only at the provider boundary. **No FX / price feeds** (PRD §18).
- `raised` is a cache; the source of truth is `SUM(Gift.amount WHERE verified)`. Recompute inside the credit transaction.
- Anonymity is **display-only**: `senderAddress` is always stored (needed for dedupe, support, abuse handling); it is simply never serialized to the public API when `anonymous`.
- Store birthday as month/day (+ optional year) so the countdown targets the next occurrence.

---

## 11. Limitations, risks & blockers in the current Nimiq Mini Apps APIs

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| **R1** | **USDT/Polygon gap.** Nimiq Pay users hold USDT on Polygon; the mini-app Ethereum provider doesn't expose Polygon. No documented way to move that balance from a mini app. | USDT gifting (PRD §7) may be **impossible today**. | Ship NIM-only MVP. Build `currency` abstraction. Get a written answer from Nimiq on (a) will Polygon be exposed, (b) does gas abstraction extend to mini apps, (c) the canonical token/chain config to read at runtime. Gate USDT on a server flag + live provider chain check. |
| **R2** | **No transaction-lookup or event API** in the mini-app provider. | NIMday must run its own verification infra. | Backend worker with `@nimiq/core` web client (§4). Accepted cost. |
| **R3** | **No official public mainnet Nimiq RPC.** | Can't just call a hosted endpoint. | `@nimiq/core` light client (P2P consensus, no node to run) is the primary path; self-hosted Albatross node is the fallback. |
| **R4** | `sendBasicTransaction` return value: docs say "hash", bundled JSDoc says "serialized transaction". | Verification keys off the wrong value → nothing confirms. | Phase 0 spike resolves this. If serialized: parse/compute hash server-side with `@nimiq/core`. |
| **R5** | **No confirmation callback / webhook.** | Must poll; "Payment verified" screen needs a waiting state. | Short-interval polling of the worker; optimistic "Sent!" UI, then "Verified ✓" when the worker credits. PRD §11 wording already fits a two-step reveal. |
| **R6** | **Mini apps only run inside the Nimiq Pay WebView.** A WhatsApp link opens a normal browser with **no `window.nimiq`**. | The PRD's "view without a wallet, then gift" flow (§2, §4, §16) has an undefined transition: how does a visitor in Safari get *into* Nimiq Pay to gift? | **PRD gap — must be designed with Nimiq.** Need a deep link / "Open in Nimiq Pay" handoff, or accept that gifting requires the visitor to already have Nimiq Pay and open the link there. Public card viewing works fine in any browser; only the gift/publish steps need the WebView. |
| **R7** | `sign()` verifiability and single-account assumption not spelled out in docs. | Auth design (§8) depends on it. | Spike: sign a nonce, verify with `@nimiq/core`, confirm `publicKey` ↔ `listAccounts()[0]`. |
| **R8** | `data` field size for `sendBasicTransactionWithData` not documented. | Memo scheme (§3/§4) could exceed the limit. | Keep memo ≤ ~40 bytes; confirm the 64-byte cap in the spike; have a no-memo fallback matcher (recipient+amount+time-window). |
| **R9** | SDK is v0.1.0, pre-1.0. | APIs may change; chain list may change. | Pin exact version; read the provider's advertised capabilities at runtime; keep the Nimiq integration behind a thin adapter module. |
| **R10** | Reorg / `invalidated` state after crediting. | Progress could reflect a reversed payment. | Only credit at `confirmed`; worker also watches for `invalidated` and reverses. |
| **R11** | Image uploads (profile photo, wish images) = abuse/moderation surface. | Not a Nimiq risk but MVP-relevant. | Size/type limits, dimension caps, store in R2/S3, optional automated moderation, creator can remove. |

**PRD items to clarify or correct (flagged, not guessed):**
- **§2/§4/§16 visitor flow** — see R6. The "one link that just works from WhatsApp for gifting" is not achievable with documented APIs; viewing is.
- **§7 USDT** — see R1; the config the PRD tells us to "use" isn't reachable from a mini app today.
- **§8 "correct amount"** — undefined for a contribution model. Recommend: any amount > 0 counts; display caps at target (PRD §10).
- **§5.2 "Buy this gift"** — there's no purchase/fulfilment mechanism; it's a *label* on a gift + contributions. MVP should not imply an e-commerce checkout.
- **§15 "total gifted"** — must be per-currency (no conversion). One number across NIM+USDT would require a price feed, which §18 forbids.
- **§21 Gift "Sender" + §9 anonymity** — store the real address always; hide at render time only.

---

# Summary

## A. Recommended tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | SSR for the public card + OG link previews (PRD §16); client components for mini-app flows |
| Styling | Tailwind CSS + a small component set (Radix primitives) | fast, mobile-first, "premium birthday" not "crypto dashboard" (§18) |
| Mini-app integration | `@nimiq/mini-app-sdk` (pinned 0.1.0) behind an internal `nimiq/` adapter | isolate a pre-1.0 dependency |
| DB | **PostgreSQL** (Neon or Supabase) + **Prisma** | relational model is a clean fit; strong unique constraints for dedupe |
| Verification | **`@nimiq/core` web client in a persistent Node worker** | P2P consensus, no node to host, gives `getTransaction` state + confirmations |
| EVM reads (USDT, later) | server-side RPC (Alchemy/Ankr/public) for the Nimiq-approved chain | never trust client verification |
| Image storage | Cloudflare R2 or S3 | cheap, presigned uploads |
| Hosting | Next.js on Vercel; worker on Railway/Fly/Render | serverless everywhere except the one long-lived client |
| Auth | Sign-In With Nimiq (challenge + `sign()`), JWT in httpOnly cookie | no passwords/email/seed (§19/§20) |
| Secrets | platform env vars / secret manager; nothing in repo | §20 |

## B. Recommended architecture

Serverless Next.js (public SSR pages + API routes) + **one** always-on Node verification worker + Postgres + object storage. Wallet lives entirely in Nimiq Pay; NIMday holds no keys and no funds; payments go wallet→wallet; the backend only records intents and credits verified transactions. See the diagram in §9.

## C. Nimiq integration plan

1. `init()` → detect WebView, `getHostLanguage()` for locale.
2. **Creator:** `listAccounts()` at publish → store `creatorAddress`; block publish without it.
3. **Auth:** nonce → `sign(nonce)` → verify signature + address derivation server-side → session cookie; authorize every mutation by `creatorAddress`.
4. **Gift (NIM):** backend `GiftIntent{memo}` → `sendBasicTransactionWithData({recipient, value, data: memo})` → return `txHash` to backend.
5. **USDT:** deferred behind a flag; `eth_requestAccounts` + `eth_sendTransaction` to the Nimiq-approved token contract *iff* the provider exposes a chain the user holds USDT on (R1).
6. All Nimiq calls go through one adapter module; read provider capabilities at runtime; pin SDK version.

## D. Payment verification plan

Worker polls each submitted intent:
- **NIM:** `client.getTransaction(txHash)` — assert exists, mainnet `networkId`, `to == creatorAddress`, `value` matches, `data == memo`, `state == 'confirmed'` (≥10 conf), `txHash` unused, capture `from`.
- **USDT:** `eth_getTransactionReceipt` — `status 0x1`, approved chain, `Transfer` log to creator EVM address for the approved token contract with the right amount, ≥ N confirmations, `txHash` unused, capture `from`.
- **Credit atomically:** insert `ProcessedTransaction` + `Gift(verified)` + recompute `wish.raised` + append `Activity`. Idempotent. Reverse on later `invalidated`. Reconciliation cron catches intents whose tx landed after timeout.

## E. Database model

`User, Birthday, Wish, GiftIntent, Gift, ProcessedTransaction, Message, Activity` — full Prisma schema in §10. Key invariants: `Gift.txHash` unique + `ProcessedTransaction` ledger (double-credit guard); money as `Decimal` per-currency, no FX; anonymity is render-time only; birthday stored as month/day.

## F. Risks / blockers

- **R1 (blocker for USDT):** no documented mini-app path to Polygon USDT → **NIM-only MVP**, USDT flag-gated pending Nimiq's answer.
- **R6 (design gap):** shared links open a plain browser with no wallet; the view→gift transition into Nimiq Pay is undefined in the PRD and undocumented → needs Nimiq guidance.
- **R2/R3:** no lookup API and no public mainnet RPC → must run the `@nimiq/core` worker.
- **R4/R7/R8:** three small doc ambiguities (tx-hash return, `sign()` verifiability, memo size) → resolved by the Phase 0 spike.
- **R5/R10:** no webhooks + reorg handling → polling worker + credit only at finality.

## G. Exact implementation phases

**Phase 0 — Spike & confirm (no product code).** A throwaway mini app run inside Nimiq Pay to verify: `listAccounts`, `sign()` + server-side verification + address derivation, `sendBasicTransactionWithData` return value and memo landing on-chain, `@nimiq/core` verification in Node, memo size limit. In parallel, get written answers from Nimiq on **R1** (USDT chain/token/gas for mini apps) and **R6** (how a visitor opens a shared mini-app link to gift). *Gate: don't proceed to Phase 2/USDT until these are answered.*

**Phase 1 — Foundations & creator flow (no payments).** Repo, Next.js, Prisma/Postgres, `nimiq/` adapter. Sign-In With Nimiq. Create/edit birthday (name, month/day, message, theme, photo), wishlist (≤5, title/image/description/target/currency/gift-type), preview, publish (captures `creatorAddress`), unique share slug, SSR public card with OG tags, countdown.

**Phase 2 — NIM gifting + verification.** `GiftIntent` API, gift flow UI (pick wish → amount → anonymous toggle → send), verification worker with warm `@nimiq/core` client, dedupe ledger, wish-progress recompute, "Sent → Verified" confirmation screen (PRD §11), activity feed, reconciliation cron.

**Phase 3 — Messages, dashboard, quest.** Birthday messages (public/anonymous, length-capped, sanitized, creator can hide). "My NIMday" dashboard (preview, countdown, wishes + progress, gift count, per-currency totals, recent activity, edit/preview/share/copy-link). Birthday Quest (view → choose → gift → message) with **no spend-based rewards** (§17).

**Phase 4 — USDT (conditional on Phase 0/R1).** If Nimiq confirms a workable chain/token: `eth_requestAccounts` at publish (`creatorEvmAddress`), `eth_sendTransaction` ERC-20 transfer, server-side receipt/log verification, same credit path. If still blocked: ship without it, document the limitation, keep the flag.

**Phase 5 — Hardening & launch.** Rate limiting, abuse/moderation for images and messages, finality/reorg tests, monitoring/alerting on the worker and consensus health, secret-management review, load test the public card, accessibility & mobile polish.

---

## Sources

- [Nimiq Mini Apps overview](https://nimiq.dev/mini-apps/) — providers, exposed EVM chains, security model
- [Nimiq Provider API reference](https://nimiq.dev/mini-apps/api-reference/nimiq-provider) — `listAccounts`, `sign`, `sendBasicTransaction(WithData)`, return values
- [Ethereum Provider API reference](https://nimiq.dev/mini-apps/api-reference/ethereum-provider) — `eth_requestAccounts`, `eth_sendTransaction`, `eth_getTransactionReceipt`
- [`@nimiq/mini-app-sdk` on jsDelivr](https://cdn.jsdelivr.net/npm/@nimiq/mini-app-sdk@0.1.0/dist/provider.d.ts) — provider type definitions (v0.1.0)
- [`@nimiq/core` (Web Client) on npm](https://www.npmjs.com/package/@nimiq/core) — Rust→WASM light client for browser + Node.js
- [Web Client vs RPC Client](https://nimiq.dev/build/web-client-rpc)
- [Nimiq JSON-RPC: get transaction by hash](https://nimiq.dev/rpc/methods/get-transaction-by-hash)
- [onmax/albatross-rpc-client-ts](https://github.com/onmax/albatross-rpc-client-ts) — typed Nimiq RPC client; testnet endpoint `rpc.nimiq-testnet.com`
- [Nimiq blog: USDC via OpenGSN & Uniswap](https://www.nimiq.com/blog/a-look-into-nimiq-wallets-integration-of-usdc-through/) — wallet-side stablecoin/gas-abstraction background
- [HackerNoon: Nimiq Mini Apps framework](https://hackernoon.com/nimiqs-mini-apps-framework-charges-0percent-where-apple-charges-30percent-inside-open-framework-for-developers) — USDT-on-Polygon + gas abstraction context
- USDT on Polygon contract `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` (6 decimals) — documented as the Nimiq Pay *wallet* configuration
