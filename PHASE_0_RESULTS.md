# Phase 0 Results

**Date:** 2026-09-02
**Scope:** validate the Nimiq integration assumptions in `TECHNICAL_PLAN.md`. No product code.

### What was actually executed vs. documented

| Evidence level | Items |
|---|---|
| **Executed** (ran real code) | `@nimiq/core` light client in Node.js reaching **mainnet** consensus and returning a confirmed transaction via `getTransaction(hash)`; server-side signature verification + address derivation with `@nimiq/core`. |
| **Source-verified** (package code + official API reference) | `@nimiq/mini-app-sdk@0.1.0` method signatures & return types; `@nimiq/core@2.21.0` type docs (64-byte data cap, tx detail shape); Nimiq Pay EVM provider method list; deep-link formats. |
| **Not executed — needs a device inside Nimiq Pay** | `listAccounts()` output; `sign()` byte scheme; observed `sendBasicTransaction` return; `data`-limit rejection behaviour; deep-link path preservation; EVM/Polygon switch + gas. A ready-to-run harness (`spike/index.html`) covers all of these. |

I have no Nimiq Pay device/emulator, so the on-device items could not be run here. Each has a defined fallback and none blocks starting Phase 1.

---

## 1. Wallet Connection

* **Status: PARTIAL** (source-verified; on-device run pending)
* **What was tested:** read `@nimiq/mini-app-sdk@0.1.0` dist source and the official Nimiq Provider API reference; built `spike/index.html` to run the calls in Nimiq Pay.
* **Actual result:**
  * `init()` = polls for `window.nimiq` every 50 ms (10 s default timeout), resolves to the **host-injected provider object**. `getHostLanguage()` = `window.nimiqPay?.language`.
  * Provider methods present in the shipped code: `listAccounts()`, `sign()`, `isConsensusEstablished()`, `getBlockNumber()`, `sendBasicTransaction()`, `sendBasicTransactionWithData()` (+ staking methods NIMday won't use).
  * API reference: `listAccounts()` → `string[]` of **user-friendly addresses**; rejection → `PermissionDeniedError`. `isConsensusEstablished()` → `boolean`. `getBlockNumber()` → `number`.
  * Note: `init()` returns `window.nimiq` itself. The `NimiqProvider` class exported from `@nimiq/mini-app-sdk/provider` is a separate object with its own optional RPC-URL mode — do not conflate.
* **Important findings:** nothing surprising; matches `TECHNICAL_PLAN.md`. Connect only on explicit user action; gate the gift UI on `isConsensusEstablished()`.

## 2. NIM Transaction

* **Status: PARTIAL** (denomination + signature confirmed; return value needs device)
* **API used:** `sendBasicTransaction({ recipient, value, fee?, validityStartHeight? })`, `sendBasicTransactionWithData({ …, data })`.
* **Actual return value:**
  * Official API reference states **`string` — transaction hash** for both methods.
  * The `@nimiq/mini-app-sdk` bundled `provider.d.ts` JSDoc says *"the serialized transaction"* and types it `Promise<string | ErrorResponse>`. **Conflict.** The prose reference is newer and explicit; treat as **tx hash**, but the harness prints `typeof` / `length` / `JSON.stringify` to confirm on device.
* **Important findings:**
  * **`1 NIM = 100,000 Luna` confirmed** (API reference + `@nimiq/core` types: "*fee in luna (NIM's smallest unit)*"; Nimiq uses 5 decimals). `value` and `fee` are integer Luna.
  * Omit `fee` — "Nimiq Pay chooses a fee automatically, using 0 if possible."
  * Errors: `PermissionDeniedError` (user declined), `InvalidTransactionError` (malformed).
  * `data` is a required `string` on the `WithData` variant (docs example: `data: 'mic check'`).
  * Not executed — needs testnet NIM (claimable in-app: dev menu → testnet → "Get free NIM", 110,000 test NIM).

## 3. Transaction Data

* **Status: PASS** (authoritative source) — rejection behaviour still worth an on-device glance
* **Maximum size: 64 bytes.** Source: `@nimiq/core@2.21.0` type documentation — *"For transactions to 'basic' address types, this field can contain up to 64 bytes of unstructured data."*
* **Format:** arbitrary bytes. `sendBasicTransactionWithData` accepts a JS `string`. On-chain the field appears as `{ type: "raw", raw: "<hex>" }` (seen in the executed `getTransaction` output).
* **Important findings:**
  * A transaction carrying `data` serialises as an **"extended"** transaction (`format: "basic" | "extended"`) — slightly larger, slightly higher fee. Not a problem.
  * Behaviour past 64 bytes is undocumented; expect a client-side `InvalidTransactionError`. Harness probes it.
  * NIMday's `nimday:<shortId>` memo (~20 bytes) fits comfortably. Keep it ≤ 40 bytes.

## 4. Sign-In Authentication

* **Status: PARTIAL** — server side proven; client-side byte scheme pending
* **Signature format:** `sign(string | { message, isHex? })` → `{ publicKey: string, signature: string }`, both hex. Ed25519 (32-byte pubkey, 64-byte signature).
* **Verification approach (EXECUTED, works):** with `@nimiq/core@2.21.0` in plain Node.js —
  * `PublicKey.fromHex(pub).verify(Signature.fromHex(sig), dataBytes)` → `true` for correct data, `false` for tampered data.
  * `PublicKey.fromHex(pub).toAddress().toUserFriendlyAddress()` → derives the `NQ…` address; matched the signer in the test. `SignatureProof.singleSig(pub, sig).isSignedBy(Address)` also works.
  * ⇒ address is reliably derivable and the signature reliably verifiable server-side. No external service, no RPC.
* **Important findings:**
  * **Outstanding:** what bytes Nimiq Pay's `sign()` actually signs. Self-test confirms the **raw-UTF-8-bytes** path verifies. Nimiq Pay may instead sign a hashed/prefixed form (`"\x16Nimiq Signed Message:\n" + len + msg`, then SHA-256 — the Keyguard convention). `spike/verify-node/check-signature.cjs` tests all three encodings; run it once against a real device `sign()` result to lock this down. Architecture is unaffected — only which buffer the verifier feeds to `verify()`.
  * `isHex: true` lets you sign a raw-hex nonce directly.
  * Flow from `TECHNICAL_PLAN.md` §8 stands: nonce → `sign` → verify + derive address → httpOnly session cookie; authorize every mutation by `birthday.creatorAddress`.

## 5. Transaction Verification

* **Status: PASS** — architecture validated by execution
* **Recommended verification method:** `@nimiq/core` light client in a long-lived Node process.
  * Executed: `Client.create()` → `waitForConsensusEstablished()` → `getTransaction(hash)`, against **mainnet**, from a plain Node script — **no self-hosted node, no RPC endpoint** (`sync_mode: pico`, `storage: Volatile`). Consensus in ~10–12 s. `getNetworkId()` → `24` (mainnet Albatross).
  * `getTransaction(hash)` returns `PlainTransactionDetails`: `state`, `confirmations`, `blockHeight`, `timestamp`, `sender`, `recipient` (user-friendly), `value` (Luna), `fee`, `data` (`{type,raw}`), `senderData`, `network` (`"mainalbatross"`), `format`, `flags`, `executionResult`.
* **Confirmation approach:**
  * `state` ∈ `"new" | "pending" | "included" | "confirmed" | "invalidated" | "expired"`. Credit only on **`"confirmed"`** (`@nimiq/core` default = 10 confirmations; ~seconds at ~1 s block time — a 20-min-old tx in the test showed `confirmations: 1173`).
  * sender = `.sender`, recipient = `.recipient`, amount = `.value`, memo = decode `.data.raw` (hex) and match `nimday:<id>`, network = `.network`.
  * Duplicate protection = our DB (`processed_transactions`, unique on hash).
  * Reversal watch: if a credited tx later reports `"invalidated"`, reverse.
* **Worker architecture recommendation:** **keep the plan** — serverless Next.js (pages + API) + **one always-on Node worker** holding a warm `@nimiq/core` client + Postgres. The worker is necessary because (a) the mini-app provider has no tx-lookup or events, (b) there is no public Nimiq **mainnet** RPC.
  * Extras confirmed available: `Client.addTransactionListener(fn, [recipientAddr])` (fires on inclusion — lower latency than polling); `getTransactionsByAddress(recipientAddr, …)` (reconciliation fallback matcher).
  * Minor: the Node build logs harmless IndexedDB warnings and keeps volatile storage → cold start re-syncs ~10–15 s; keep the worker warm.

## 6. Shared Links / Nimiq Pay

* **Status: PARTIAL** — official mechanism exists; one detail needs a device
* **What Nimiq officially supports** (docs, "Sharing Your Mini App"): deep links in two forms —
  * Custom scheme: `nimiqpay://miniapp?url=<your-app-url>`
  * HTTPS: `https://nimpay.app/miniapps/open/<your-app-url>`
  * "Nimiq Pay opens and loads your mini app with full provider access." "It works with any domain." Unknown/first-seen URLs show a warning screen first.
* **Recommended flow:**
  1. `https://nimday.app/b/<slug>` — public card, opens in any browser, no wallet needed, fully viewable (SSR + OG tags for WhatsApp/Telegram previews).
  2. "Send a gift" → `https://nimpay.app/miniapps/open/https://nimday.app/b/<slug>?gift=1` (or the `nimiqpay://` scheme; offer both).
  3. Nimiq Pay reopens that URL in its WebView; `window.nimiq` present; gift + `sign()` proceed.
* **Unresolved dependency:** confirm the deep link **preserves the full path + query** (`/b/<slug>?gift=1`), not just the domain — the docs only show a bare domain. Fallbacks if it doesn't: carry the slug in the URL fragment, or a short redirect route. Also confirm the first-open warning UX and whether directory-listing the app suppresses it. **Not a blocker** — a documented path exists.

## 7. USDT

* **Status: BLOCKED for MVP** (technically possible, not viable)
* **Supported networks:** the EVM provider (`window.ethereum`, EIP-1193/6963) **does support Polygon.** The official "Using EVM Tokens" guide uses **USDT on Polygon** (`0xc2132D05D31c914a87C6611C10748AEb04B58e8F`, 6 decimals, chain `0x89`) as its worked example; `wallet_switchEthereumChain` / `wallet_addEthereumChain` to `0x89` are documented. (The overview page's chain list omits Polygon and is inconsistent with this — the EVM-tokens page governs.) Read methods for verification are available via `rpcCall`: `eth_getTransactionReceipt`, `eth_getLogs`, `eth_blockNumber`, `eth_call`, `net_version` (note: **no `eth_getTransactionByHash`** in the documented set — verify via receipt + Transfer logs).
* **Whether a Nimiq Pay user can send the USDT they hold:** **not practically.** Official doc, verbatim: *"When sending ERC-20 tokens through a mini app … standard EVM gas rules apply. The user must hold the native token of the chain to cover gas fees. On Polygon, this is POL … If the user has no native token balance, the transaction will fail."* Native Nimiq Pay USDT sends use gas abstraction; **mini-app EVM sends do not.** A gift-giver holding only USDT cannot pay gas.
* **Recommendation:** **USDT out of MVP.** Ship NIM-only. Keep a `currency` enum (`NIM | USDT`) wired end-to-end but feature-flag USDT off. Do **not** substitute another chain/token. Revisit only if Nimiq extends gas abstraction to mini-app EVM transactions — worth asking them directly. This matches the PRD treating USDT as secondary.

## 8. Architecture Changes

Changes to `TECHNICAL_PLAN.md`:

1. **R1 / §5 / §6 — reframe the USDT blocker.** Not "Polygon isn't exposed" (it is). The real blocker: **mini-app EVM sends have no gas abstraction**, so a USDT-only holder can't pay POL gas. Net effect unchanged (USDT deferred), reason corrected.
2. **R6 — downgrade from "undocumented" to "documented, one detail open".** Deep links exist: `nimiqpay://miniapp?url=` and `https://nimpay.app/miniapps/open/`. Open item: path+query preservation.
3. **R4 — near-resolved.** API reference explicitly says `sendBasicTransaction` returns the **tx hash**. Keep only an on-device confirmation; if it turns out to be serialized, compute the hash server-side with `@nimiq/core`.
4. **R8 — resolved.** `data` cap is **64 bytes** (from `@nimiq/core` types). Drop the uncertainty; memo ≤ 40 bytes.
5. **§8 — strengthen.** Server-side signature verify + address derivation is **executed-verified** with `PublicKey.verify` / `.toAddress()`. Only open item: the message-encoding scheme.
6. **§9 / verification worker — add specifics.** No new RPC dependency; `@nimiq/core` only. Use `addTransactionListener([recipientAddr])` for low-latency inclusion + `getTransaction` for finality; `getTransactionsByAddress` for reconciliation. Budget ~10–15 s cold-start re-sync; keep the worker warm; volatile storage is fine.
7. **Stack — add `viem`** for EVM ABI encoding *if/when* USDT is revisited (per Nimiq's own guide). Not needed for the NIM MVP.
8. **No change** to: framework choice, Postgres/Prisma, wallet-based auth, no-custody/no-contracts posture, phase ordering.

## 9. Final Decision

**BUILD: YES** — for the NIM-only MVP.

**Blockers cleared:**
* Backend transaction verification with `@nimiq/core` in Node.js — **executed against mainnet**; works with no self-hosted node and no public RPC.
* Server-side signature verification + address derivation — **executed**; works.
* SDK surface, denomination (1 NIM = 100,000 Luna), 64-byte `data` cap, return types — confirmed from package source + `@nimiq/core` types + official API reference.
* Shared-link → Nimiq Pay handoff — an **officially documented deep-link mechanism** exists.
* Worker + Next.js + Postgres architecture — validated end to end.

**Confirm on-device during Phase 1 (each has a fallback; none blocks starting):**
* exact byte scheme used by `sign()` — run `check-signature.cjs` against a real result.
* observed return of `sendBasicTransaction` (hash vs serialized).
* deep link preserves full path + query.

**Out of MVP scope:** USDT — no gas abstraction for mini-app EVM sends. Consistent with the PRD (USDT = secondary).

**Do not proceed to Phase 1 without explicit approval.**
