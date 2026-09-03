/*
 * Phase 0 PoC — can a plain Node.js process verify a Nimiq mainnet transaction
 * using only @nimiq/core (a P2P light client), with NO self-hosted RPC node?
 *
 *   npm install @nimiq/core
 *   node check-transaction.cjs <txHash>
 *   node check-transaction.cjs                 # lists recent tx for the burn address
 *
 * VERIFIED WORKING 2026-09-02: consensus in ~10s, getTransaction() returns
 * { state:'confirmed', confirmations, sender, recipient, value, data, ... }.
 */
const Nimiq = require('@nimiq/core');

const TX = process.argv[2] || null;
const ADDR = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';

(async () => {
  const t0 = Date.now();
  const config = new Nimiq.ClientConfiguration();
  config.logLevel('warn');
  const client = await Nimiq.Client.create(config.build());
  await client.waitForConsensusEstablished();
  console.log(`consensus in ${((Date.now() - t0) / 1000).toFixed(1)}s | networkId=${await client.getNetworkId()} | head=${await client.getHeadHeight()}`);

  if (TX) {
    console.log(JSON.stringify(await client.getTransaction(TX), null, 2));
  } else {
    const txs = await client.getTransactionsByAddress(ADDR, null, null, null, 3, 1);
    for (const tx of txs) console.log(`${tx.transactionHash}  ${tx.state}  conf=${tx.confirmations}  ${tx.value} luna  ${tx.sender} -> ${tx.recipient}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
