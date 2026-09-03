/*
 * Phase 0 PoC — server-side verification of a Nimiq signature with @nimiq/core.
 *
 *   npm install @nimiq/core
 *   node check-signature.cjs                                  # self-test (generate → sign → verify)
 *   node check-signature.cjs <publicKeyHex> <signatureHex> <message>   # verify a real sign() result from index.html
 *
 * VERIFIED WORKING 2026-09-02 for the self-test path (raw-bytes signing).
 * The OUTSTANDING UNKNOWN is what bytes Nimiq Pay's mini-app sign() actually signs
 * (raw UTF-8? a hashed "\x16Nimiq Signed Message:\n"+len prefix?). Run the second
 * form with a real sign() output to find out which `data` makes verify() return true.
 */
const Nimiq = require('@nimiq/core');
const enc = (s) => new TextEncoder().encode(s);

async function verify(pubHex, sigHex, message) {
  const pk = Nimiq.PublicKey.fromHex(pubHex);
  const sig = Nimiq.Signature.fromHex(sigHex);
  const address = pk.toAddress().toUserFriendlyAddress();

  const candidates = {
    'raw utf-8': enc(message),
    'sha256(raw)': new Uint8Array(await crypto.subtle.digest('SHA-256', enc(message))),
    'nimiq-signed-message-prefix': await (async () => {
      const p = enc('\x16Nimiq Signed Message:\n' + message.length + message);
      return new Uint8Array(await crypto.subtle.digest('SHA-256', p));
    })(),
  };
  console.log('derived address from publicKey:', address);
  for (const [name, data] of Object.entries(candidates)) {
    let ok = false;
    try { ok = pk.verify(sig, data); } catch {}
    console.log(`  verify(${name}) -> ${ok}`);
  }
}

(async () => {
  if (Nimiq.default) { try { await Nimiq.default(); } catch {} }
  const [, , a, b, ...rest] = process.argv;
  if (a && b) { await verify(a, b, rest.join(' ')); return process.exit(0); }

  // self-test
  const kp = Nimiq.KeyPair.generate();
  const msg = 'NIMday login\nnonce=abc123';
  const sig = kp.sign(enc(msg));
  console.log('self-test address:', kp.toAddress().toUserFriendlyAddress());
  await verify(kp.publicKey.toHex(), sig.toHex(), msg);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
