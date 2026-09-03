# NIMday — Phase 0 Spike Harness

Throwaway test code to validate Nimiq integration assumptions. **Not product code.**
Results are written up in [`../PHASE_0_RESULTS.md`](../PHASE_0_RESULTS.md).

## `index.html` — on-device mini-app checks

The smallest possible mini app. Exercises every Nimiq/EVM provider call NIMday depends on
and logs the raw results to screen.

**Run it:**
1. Host this folder over HTTPS (or `npx serve spike` on a machine on your phone's Wi-Fi).
2. Nimiq Pay → Mini Apps → **Custom URL** → enter the URL.
3. For transaction tests: open Nimiq Pay's hidden dev menu (long-press the settings
   button for 10s) → switch account to **testnet** → tap **Get free NIM**.
4. Put your own testnet address in the "recipient" field so test sends go to yourself.

Read-only checks (`init`, consensus, block height) run automatically on load.
Everything that spends or signs needs a button tap.

The important observations:
- **`listAccounts()`** — is the returned string a user-friendly `NQ…` address?
- **`sendBasicTransaction()` return value** — the log prints `JSON.stringify`, `typeof`
  and `length` so you can see if it's a 64-hex tx hash or something else.
- **`sign()`** — copy the `{publicKey, signature}` JSON into the Node script below.
- **data-length probe** — find the byte count at which `sendBasicTransactionWithData`
  starts rejecting.
- **EVM section** — does `wallet_switchEthereumChain → 0x89` work, and does a transfer
  succeed when the native POL balance is `0x0`?

## `verify-node/` — backend verification PoC

Proves NIMday's backend can verify transactions with just `@nimiq/core` (a P2P light
client) — no self-hosted Nimiq node.

```sh
cd verify-node
npm install

# Verify a real mainnet transaction by hash:
node check-transaction.cjs <txHash>

# Signature verification — self-test, then with a real sign() result:
node check-signature.cjs
node check-signature.cjs <publicKeyHex> <signatureHex> "<the exact message you signed>"
```

`check-signature.cjs` tries three candidate encodings (raw UTF-8, SHA-256, Nimiq
signed-message prefix) so you can see which one Nimiq Pay's `sign()` actually uses.

## Status (2026-09-02)

| What | How verified |
|---|---|
| `@nimiq/core` reaches consensus in Node in ~10s, `getTransaction(hash)` returns full confirmed details | **executed** ✅ |
| Server-side signature verify + address derivation (raw-bytes path) | **executed** ✅ |
| SDK method signatures, return types, `data` = 64-byte cap | **docs + package source** ✅ |
| `sign()` byte scheme, `sendBasicTransaction` observed return, deep-link path preservation, EVM/Polygon + gas | **needs a device** ⏳ |
