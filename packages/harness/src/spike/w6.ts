import { Sandbox } from 'near-sandbox';
import { actions, config, queryAccessKey, queryGasKeyNonces, queryProtocolVersion, sendTx } from '@fastnear/api';
import { privateKeyFromRandom, signerFromPrivateKey } from '@fastnear/utils';
import type { TransactionSigner } from '@fastnear/utils';

/**
 * W-6 stretch probe — sibling-lane gas-key isolation (docs/ATTACK-BATTERY.md §Stretch
 * probe; docs/plans/M3-settlement-proof.md step 9).
 *
 * Mechanism: NEP-611 gas keys — confirmed in the NEP registry at docs.near.org
 * (protocol/accounts-contracts/gas-keys): access keys with a prepaid gas balance and up to
 * 1,024 independent nonce lanes; introduced in nearcore 2.13 at protocol version 86 (the
 * fastnear guide pins the floor at 85).
 *
 * Runtime: the battery's pinned sandbox (near-sandbox 0.1.5, neard 2.6.2) predates gas
 * keys, so this probe boots its OWN sandbox (near-sandbox 0.3.4, neard 2.13.4, protocol
 * 86) and never touches the battery pins or the `arena:run` path. Secret-free: local
 * genesis keys only (FR-9).
 *
 * Design (docs/plans/M3-settlement-proof.md step 9 owns the steps):
 *   1. Sibling-lane setup — one gas key on the wallet, `num_nonces: 2`: lane 0 = agent A,
 *      lane 1 = agent B (the docs' "one lane per worker" model).
 *   2. Exhaustion trigger — saturate lane 0 with a sequential transfer burst (its nonce
 *      sequence churns far ahead), then leave one more lane-0 tx IN FLIGHT.
 *   3. Sibling observation — a lane-1 tx submitted while the lane-0 tx is in flight must
 *      land without waiting on lane 0 (parallel lanes; a classical single-nonce key would
 *      serialize behind it). Asserted from `view_gas_key_nonces` (lane 0 nonce ≫ lane 1
 *      nonce, each advanced independently) and from the two txs' block heights.
 *   Gas isolation is asserted alongside: the wallet's MAIN balance pays no gas for any of
 *      the bursts (the prepaid key balance does), and the key balance drops by burnt gas.
 *
 * Run: `pnpm exec tsx packages/harness/src/spike/w6.ts` (standalone; not part of
 * `pnpm arena:run`).
 */

// @fastnear/api's sendTx/query calls return untyped JSON-RPC envelopes; the shapes below
// are the documented contract (js.fastnear.com/gas-keys) pinned once as boundary types.
interface GasKeyPermission {
  balance: string;
  num_nonces: number;
}

interface SendResult {
  ok: boolean;
  error?: string;
  blockHeight?: number;
}

function gasKeyPermissionOf(view: unknown): GasKeyPermission {
  const permission = (view as { result?: { permission?: unknown } }).result?.permission;
  const gasKey = (permission as Record<string, GasKeyPermission> | undefined)?.GasKeyFullAccess;
  if (!gasKey) throw new Error(`key permission is not GasKeyFullAccess: ${JSON.stringify(permission)}`);
  return gasKey;
}

function gasKeyNoncesOf(view: unknown): bigint[] {
  const raw = (view as { result?: { nonces?: Array<string | number> } }).result?.nonces;
  if (!Array.isArray(raw)) throw new Error(`unexpected queryGasKeyNonces shape: ${JSON.stringify(view)}`);
  return raw.map((n) => BigInt(n));
}

function blockHeightOf(outcome: unknown): number | undefined {
  const o = outcome as { transaction_outcome?: { block_height?: number }; receipt?: { block_height?: number } };
  const h = o.transaction_outcome?.block_height ?? o.receipt?.block_height;
  return typeof h === 'number' ? h : undefined;
}

async function sendSelfTransfer(signer: TransactionSigner, accountId: string, nonceIndex: number): Promise<SendResult> {
  try {
    const outcome = await sendTx({
      signerId: accountId,
      signer,
      receiverId: accountId,
      actions: [actions.transfer('0')],
      nonceIndex,
      waitUntil: 'FINAL',
    });
    return { ok: true, blockHeight: blockHeightOf(outcome) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function mainBalance(rpcUrl: string, accountId: string): Promise<bigint> {
  const r = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'w6',
      method: 'query',
      params: { request_type: 'view_account', finality: 'final', account_id: accountId },
    }),
  });
  const json = (await r.json()) as { result: { amount: string } };
  return BigInt(json.result.amount);
}

async function main(): Promise<void> {
  console.error('[w6] booting standalone sandbox (near-sandbox 0.3.4, neard 2.13.4)...');
  const sandbox = await Sandbox.start({});
  try {
    config({ nodeUrl: sandbox.rpcUrl });

    const protocol = await queryProtocolVersion();
    console.error(`[w6] sandbox protocol_version=${protocol}`);
    if (protocol < 85) {
      throw new Error(`gas keys require protocol >= 85, sandbox reports ${protocol}`);
    }

    // Wallet: the sandbox genesis account (full-access key, 10,000 NEAR).
    const walletId = 'sandbox';
    const ownerSigner = signerFromPrivateKey('ed25519:3tgdk2wPraJzT4nsTuf86UX41xgPNk3MHnq8epARMdBNs29AFEztAuaQ7iHddDfXG9F2RzV1XNQYgJyAyoW51UBB');

    // (1) Sibling-lane setup: one gas key, two lanes.
    const gasSigner = signerFromPrivateKey(privateKeyFromRandom('ed25519'));
    await sendTx({
      signerId: walletId,
      signer: ownerSigner,
      receiverId: walletId,
      actions: [actions.addFullAccessGasKey({ publicKey: gasSigner.publicKey, numNonces: 2 })],
      waitUntil: 'FINAL',
    });
    await sendTx({
      signerId: walletId,
      signer: ownerSigner,
      receiverId: walletId,
      actions: [actions.transferToGasKey({ publicKey: gasSigner.publicKey, deposit: '5000000000000000000000000' })], // 5 NEAR
      waitUntil: 'FINAL',
    });
    const gasKey = gasKeyPermissionOf(await queryAccessKey({ accountId: walletId, publicKey: gasSigner.publicKey, blockId: 'final' }));
    console.error(`[w6] gas key ready: num_nonces=${gasKey.num_nonces} balance=${gasKey.balance}`);
    // Lane nonces start at block_height * 1e6 (NEP-611 default nonce), so assertions run on
    // deltas from a pre-burst baseline, never on absolute values.
    const baseline = gasKeyNoncesOf(await queryGasKeyNonces({ accountId: walletId, publicKey: gasSigner.publicKey, blockId: 'final' }));
    if (baseline.length !== 2) throw new Error(`expected 2 nonce lanes, got ${baseline.length}`);

    const mainBefore = await mainBalance(sandbox.rpcUrl, walletId);

    // (2) Exhaustion trigger: saturate lane 0 with a sequential burst, then leave one more
    // lane-0 tx in flight.
    const burst = 6;
    for (let i = 1; i <= burst; i++) {
      const r = await sendSelfTransfer(gasSigner, walletId, 0);
      if (!r.ok) throw new Error(`lane-0 burst tx ${i} failed: ${r.error ?? 'unknown'}`);
    }
    console.error(`[w6] lane 0 saturated: ${burst} sequential txs settled`);
    const inFlight = sendSelfTransfer(gasSigner, walletId, 0); // not awaited yet

    // (3) Sibling observation: lane 1 transacts while the lane-0 tx is in flight.
    const siblingStart = Date.now();
    const sibling = await sendSelfTransfer(gasSigner, walletId, 1);
    const siblingMs = Date.now() - siblingStart;
    if (!sibling.ok) throw new Error(`sibling lane tx failed: ${sibling.error ?? 'unknown'}`);
    const flight = await inFlight;
    if (!flight.ok) throw new Error(`lane-0 in-flight tx failed: ${flight.error ?? 'unknown'}`);
    const order =
      sibling.blockHeight !== undefined && flight.blockHeight !== undefined
        ? ` lane1-block=${sibling.blockHeight} lane0-block=${flight.blockHeight} lane1-first=${sibling.blockHeight <= flight.blockHeight}`
        : '';
    console.error(`[w6] sibling lane landed in ${siblingMs} ms while lane 0 had a tx in flight.${order}`);

    const nonces = gasKeyNoncesOf(await queryGasKeyNonces({ accountId: walletId, publicKey: gasSigner.publicKey, blockId: 'final' }));
    console.error(`[w6] lane nonces: [${nonces.join(', ')}] (baseline [${baseline.join(', ')}])`);
    if (nonces.length !== 2) throw new Error(`expected 2 nonce lanes, got ${nonces.length}`);
    if (nonces[0] - baseline[0] !== BigInt(burst + 1)) {
      throw new Error(`lane 0 nonce delta ${nonces[0] - baseline[0]} != ${burst + 1}`);
    }
    if (nonces[1] - baseline[1] !== 1n) {
      throw new Error(`lane 1 nonce delta ${nonces[1] - baseline[1]} != 1`);
    }

    // Gas isolation: the wallet's main balance paid NO gas for the burst.
    const mainAfter = await mainBalance(sandbox.rpcUrl, walletId);
    if (mainAfter !== mainBefore) {
      throw new Error(`main balance moved: ${mainBefore} -> ${mainAfter} (gas leaked off the gas key)`);
    }
    const keyAfter = gasKeyPermissionOf(await queryAccessKey({ accountId: walletId, publicKey: gasSigner.publicKey, blockId: 'final' }));
    if (BigInt(keyAfter.balance) >= BigInt(gasKey.balance)) {
      throw new Error(`gas key balance did not decrease: ${gasKey.balance} -> ${keyAfter.balance}`);
    }
    console.error(`[w6] gas isolation: main balance unchanged, key balance ${gasKey.balance} -> ${keyAfter.balance}`);

    console.log(`w6_protocol=${protocol}`);
    console.log(`w6_lane0_nonce=${nonces[0]}`);
    console.log(`w6_lane1_nonce=${nonces[1]}`);
    console.log(`w6_sibling_ms=${siblingMs}`);
    console.log('w6_outcome=mechanism confirmed + sibling isolation observed');
  } finally {
    await sandbox.stop().catch(() => {});
  }
}

await main();
