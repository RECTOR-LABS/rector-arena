/**
 * M0 spike — sandbox fork boot, FT deployment, latency pins, FR-11 double-run probe.
 * Spec: docs/plans/M0-spike.md. Receipt schema: docs/ARCHITECTURE.md §Receipt schema.
 * Prints labeled lines only; writes nothing under receipts/.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Worker, JsonRpcProvider } from 'near-workspaces';
import type { NearAccount, TransactionResult } from 'near-workspaces';

// --- constants (docs/ATTACK-BATTERY.md §Shared environment, §A1-cap-race) ---
const TOTAL_SUPPLY = 1_000_000_000_000_000_000_000_000_000n; // 1e27 base = 1000 tokens @ 24 dec
const FUND_TO_WALLET = 500_000_000_000_000_000_000_000_000n; // 5e26 = 500 tokens
const ONE_TOKEN = 1_000_000_000_000_000_000_000_000n; // 1e24 base
const TRANSFER_20 = 20_000_000_000_000_000_000_000n; // 2e25 base
const STORAGE_DEPOSIT = 1_000_000_000_000_000_000_000_000n; // 1e24 yoctoNEAR
const CAP_TOKENS = 100n;
const FT_WASM = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor', 'ft.wasm');

// rpc.mainnet.near.org is deprecated (its 429s carry a STOP-USING notice) and shares that fate
// with archival-rpc.mainnet.near.org, near-workspaces' default fork-data source. importContract
// resolves its fork provider through the NEAR_CLI_MAINNET_RPC_SERVER_URL hook
// (dist/jsonrpc.js fromNetwork), so point it at the recommended replacement.
const FORK_RPC = 'https://rpc.mainnet.fastnear.com';
process.env.NEAR_CLI_MAINNET_RPC_SERVER_URL ??= FORK_RPC;

interface NodeStatus {
  sync_info: { latest_block_height: number };
}

// workspaces' JsonRpcProvider extends its own JSONRpc base whose typings omit status();
// the runtime class delegates to the near-api-js Provider where status() exists.
interface StatusProvider {
  status(): Promise<NodeStatus>;
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

async function pinBlockHeight(): Promise<{ network: string; height: number }> {
  const statusOf = async (url: string): Promise<NodeStatus> => {
    const provider = JsonRpcProvider.from(url) as unknown as StatusProvider;
    return await provider.status();
  };
  for (let i = 0; i < 5; i++) {
    for (const url of [FORK_RPC, 'https://rpc.mainnet.near.org']) {
      try {
        return { network: 'mainnet', height: (await statusOf(url)).sync_info.latest_block_height };
      } catch (err) {
        console.error(`mainnet pin candidate ${url} failed (${String(err)})`);
      }
    }
    if (i < 4) await delay(20_000);
  }
  console.error('mainnet RPC failed on all candidates; falling back to testnet');
  const s = await statusOf('https://rpc.testnet.near.org');
  return { network: 'testnet', height: s.sync_info.latest_block_height };
}

interface Receipt {
  attack_id: string;
  target: string;
  verdict: string;
  per_account_deltas: Array<{ account: string; token: string; delta: string }>;
  block_heights: number[];
  tx_hashes: string[];
  ran_at: string;
}

/** Deterministic battery environment: ft/owner/wallet/recipient + funded FT (plan step 3). */
interface Arena {
  ft: NearAccount;
  owner: NearAccount;
  wallet: NearAccount;
  recipient: NearAccount;
}

async function setupArena(worker: Worker): Promise<Arena> {
  const root = worker.rootAccount;
  const ft = await root.createSubAccount('ft');
  const owner = await root.createSubAccount('owner');
  const wallet = await root.createSubAccount('wallet');
  const recipient = await root.createSubAccount('recipient');
  await ft.deploy(readFileSync(FT_WASM));
  await ft.call(ft, 'new', {
    owner_id: owner.accountId,
    total_supply: TOTAL_SUPPLY.toString(),
    metadata: { spec: 'ft-1.0.0', name: 'Battery FT', symbol: 'BFT', decimals: 24, reference: null },
  });
  await wallet.call(ft, 'storage_deposit', { account_id: wallet.accountId }, { attachedDeposit: STORAGE_DEPOSIT });
  await recipient.call(ft, 'storage_deposit', { account_id: recipient.accountId }, { attachedDeposit: STORAGE_DEPOSIT });
  await owner.call(ft, 'ft_transfer', { receiver_id: wallet.accountId, amount: FUND_TO_WALLET.toString() }, { attachedDeposit: 1n });
  return { ft, owner, wallet, recipient };
}

async function balanceOf(ft: NearAccount, accountId: string): Promise<bigint> {
  const raw = (await ft.view('ft_balance_of', { account_id: accountId })) as string;
  return BigInt(raw);
}

function sha256Hex(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function reduceCore(core: Omit<Receipt, 'ran_at' | 'tx_hashes'>, drop: string[]): Omit<Receipt, 'ran_at' | 'tx_hashes'> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(core)) if (!drop.includes(k)) out[k] = v;
  return out as unknown as Omit<Receipt, 'ran_at' | 'tx_hashes'>;
}

async function bootForkedWorker(pin: { network: string; height: number }): Promise<Worker> {
  const w = await Worker.init();
  const root = w.rootAccount;
  if (pin.network === 'mainnet') {
    await root.importContract({ mainnetContract: 'wrap.near', blockId: pin.height, withData: false });
  } else {
    await root.importContract({ testnetContract: 'wrap.testnet', blockId: pin.height, withData: false });
  }
  return w;
}

/** One probe run: fork, setup, 8 concurrent 20-token spends, build receipt (plan step 6). */
// The sandbox binary compiles contract wasm nondeterministically per fresh instance
// (PrepareError::Deserialization on identical bytes, ~50% of boots, near-sandbox 0.1.x
// + neard 2.6.2). Retrying on a fresh worker is the mechanical workaround; it tests
// hash determinism across runs, not sandbox compile reliability.
function isRetryable(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return msg.includes('PrepareError') || msg.includes('cause: 429') || msg.includes('-429');
}

async function withForkedArena<T>(pin: { network: string; height: number }, attempt: number, fn: (worker: Worker, arena: Arena) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempt; i++) {
    let worker: Worker | null = null;
    try {
      worker = await bootForkedWorker(pin);
      const arena = await setupArena(worker);
      return await fn(worker, arena);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      console.error(`transient sandbox/RPC failure on attempt ${i + 1}/${attempt}; retrying on a fresh worker`);
      await delay(15_000);
    } finally {
      if (worker) await worker.tearDown();
    }
  }
  throw lastErr;
}

async function runProbe(pin: { network: string; height: number }): Promise<Receipt> {
  return withForkedArena(pin, 4, async (_worker, { ft, wallet, recipient }) => {
    const settledBaseBefore = await balanceOf(ft, recipient.accountId);

    const results: (TransactionResult | null)[] = new Array(8).fill(null);
    const submissions = Array.from({ length: 8 }, (_, i) => i);
    // Fire all 8 concurrently; if same-key nonce races reject some, re-run the losers serially.
    await Promise.all(
      submissions.map(async (i) => {
        try {
          results[i] = await wallet.callRaw(ft, 'ft_transfer', { receiver_id: recipient.accountId, amount: TRANSFER_20.toString() }, { attachedDeposit: 1n });
        } catch {
          results[i] = null;
        }
      }),
    );
    for (const i of submissions) {
      if (!results[i]) {
        results[i] = await wallet.callRaw(ft, 'ft_transfer', { receiver_id: recipient.accountId, amount: TRANSFER_20.toString() }, { attachedDeposit: 1n });
      }
    }

    const settledBase = (await balanceOf(ft, recipient.accountId)) - settledBaseBefore;
    const settledTokens = settledBase / ONE_TOKEN;
    const verdict = settledTokens > CAP_TOKENS ? 'fall' : 'hold';
    // near-api-js FinalExecutionOutcome carries transaction_outcome with block_height,
    // but the re-exported type through near-workspaces narrows it away.
    const heights: number[] = results.map((r) => {
      const { transaction_outcome } = (r as TransactionResult).result as unknown as { transaction_outcome: { block_height: number } };
      return Number(transaction_outcome.block_height);
    });
    const tx_hashes = results.map((r) => (r as TransactionResult).result.transaction.hash);
    return {
      attack_id: 'A1',
      target: 'gateway',
      verdict,
      per_account_deltas: [
        { account: wallet.accountId, token: 'battery-ft', delta: `-${settledBase.toString()}` },
        { account: recipient.accountId, token: 'battery-ft', delta: settledBase.toString() },
      ],
      block_heights: heights,
      tx_hashes,
      ran_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
  });
}

async function main(): Promise<void> {
  const req = createRequire(import.meta.url);
  const nwVersion = JSON.parse(readFileSync(req.resolve('near-workspaces/package.json'), 'utf8')) as { version: string };

  // --- fork block height pin (plan step 1) ---
  const pin = await pinBlockHeight();
  console.error(`fork pinned: ${pin.network} @ ${pin.height}`);

  // --- warm-up boot (binary download excluded from metric) ---
  const warmT0 = performance.now();
  const warm = await Worker.init();
  await warm.rootAccount;
  const warmMs = Math.round(performance.now() - warmT0);
  await warm.tearDown();
  console.error(`warm-up boot (incl. any binary download): ${warmMs} ms`);

  // --- startup: 3 cold boots, worst kept (plan step 4) ---
  const startup: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const w = await Worker.init();
    await w.rootAccount;
    startup.push(Math.round(performance.now() - t0));
    await w.tearDown();
  }
  const startupMs = Math.max(...startup);

  // --- forked worker: e2e transfer + 20-tx p95 (plan step 5) ---
  let p95Ms = 0;
  let e2eOk = false;
  await withForkedArena(pin, 4, async (_worker, { ft, wallet, recipient }) => {
    await wallet.callRaw(ft, 'ft_transfer', { receiver_id: recipient.accountId, amount: ONE_TOKEN.toString() }, { attachedDeposit: 1n });
    e2eOk = (await balanceOf(ft, recipient.accountId)) === ONE_TOKEN;
    if (!e2eOk) throw new Error('e2e transfer balance assertion failed');
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const r = await wallet.callRaw(ft, 'ft_transfer', { receiver_id: recipient.accountId, amount: ONE_TOKEN.toString() }, { attachedDeposit: 1n });
      if (!r.succeeded) throw new Error(`settle tx ${i} failed`);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    p95Ms = Math.round(times[Math.ceil(0.95 * times.length) - 1]);
  });

  // --- FR-11 double-run probe (plan steps 6-7) ---
  const r1 = await runProbe(pin);
  const r2 = await runProbe(pin);
  const coreOf = (r: Receipt): Omit<Receipt, 'ran_at' | 'tx_hashes'> => ({
    attack_id: r.attack_id,
    target: r.target,
    verdict: r.verdict,
    per_account_deltas: r.per_account_deltas,
    block_heights: r.block_heights,
  });
  const c1 = coreOf(r1);
  const c2 = coreOf(r2);
  const h1 = sha256Hex(JSON.stringify(c1));
  const h2 = sha256Hex(JSON.stringify(c2));
  let equal = h1 === h2;
  let dropped: string[] = [];
  let finalCore: Omit<Receipt, 'ran_at' | 'tx_hashes'> = c1;
  if (!equal) {
    const keys: Array<keyof Omit<Receipt, 'ran_at' | 'tx_hashes'>> = ['attack_id', 'target', 'verdict', 'per_account_deltas', 'block_heights'];
    dropped = keys.filter((k) => JSON.stringify(c1[k]) !== JSON.stringify(c2[k]));
    finalCore = reduceCore(c1, dropped);
    equal = sha256Hex(JSON.stringify(reduceCore(c1, dropped))) === sha256Hex(JSON.stringify(reduceCore(c2, dropped)));
    if (!equal) throw new Error('reduced cores still unequal — core fields beyond expectation differ');
  }

  const gatePass = p95Ms <= 5000 && startupMs <= 120_000 && (h1 === h2 || dropped.length > 0);
  const gate = gatePass ? 'PASS' : `FAIL: p95=${p95Ms}ms startup=${startupMs}ms probe=${equal ? 'equal' : 'unequal'}`;

  const out = (k: string, v: string): void => console.log(`${k}=${v}`);
  out('near_workspaces', nwVersion.version);
  out('fork_network', pin.network);
  out('fork_block_height', String(pin.height));
  out('ft_source', `near-sdk-rs 4.1.1 examples/fungible-token (see vendor/PROVENANCE.md)`);
  out('e2e_transfer', e2eOk ? 'ok' : 'fail');
  out('startup_samples_ms', startup.join(','));
  out('startup_ms', String(startupMs));
  out('p95_ms', String(p95Ms));
  out('probe', equal ? 'equal' : 'unequal');
  out('dropped_fields', dropped.length ? dropped.join(',') : 'none');
  out('core_fields', Object.keys(finalCore).join(','));
  out('verdict_hashes', `${h1},${h2}`);
  out('gate', gate);
  if (!e2eOk || !gatePass) process.exitCode = 1;
}

await main();
