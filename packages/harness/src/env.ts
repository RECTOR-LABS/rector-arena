import { readFileSync } from 'node:fs';
import { JsonRpcProvider, Worker } from 'near-workspaces';
import type { NearAccount } from 'near-workspaces';
import { FUND_WALLET, FORK_RPC, FT_WASM, STORAGE_DEPOSIT, TOTAL_SUPPLY } from './config.js';

process.env.NEAR_CLI_MAINNET_RPC_SERVER_URL ??= FORK_RPC;

export interface ForkPin {
  network: 'mainnet' | 'testnet';
  height: number;
}

interface NodeStatus {
  sync_info: { latest_block_height: number };
}

// workspaces' JsonRpcProvider typings omit status(); the runtime class delegates to the
// near-api-js Provider where status() exists (same cast as the M0 spike).
interface StatusProvider {
  status(): Promise<NodeStatus>;
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

export async function pinBlockHeight(): Promise<ForkPin> {
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

async function bootForkedWorker(pin: ForkPin): Promise<Worker> {
  const w = await Worker.init();
  const root = w.rootAccount;
  if (pin.network === 'mainnet') {
    await root.importContract({ mainnetContract: 'wrap.near', blockId: pin.height, withData: false });
  } else {
    await root.importContract({ testnetContract: 'wrap.testnet', blockId: pin.height, withData: false });
  }
  return w;
}

// The sandbox binary compiles contract wasm nondeterministically per fresh instance
// (PrepareError::Deserialization on identical bytes, ~50% of boots) and concurrent fork-data
// fetches have surfaced RPC JSON parse errors; retrying on a fresh worker is the workaround
// recorded in docs/ROADMAP.md §M0 spike record.
function isRetryable(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return msg.includes('PrepareError') || msg.includes('429') || msg.includes('Failed to parse');
}

/**
 * Boot a forked sandbox at the pinned height and provision the battery environment:
 * ft/owner/agent/wallet/attacker/recipient + funded FT (docs/ATTACK-BATTERY.md §Shared
 * environment; victim is A5-only and is never provisioned at M1).
 */
export async function bootForkedArena(pin: ForkPin, attempts = 4): Promise<{ worker: Worker; arena: ArenaProvisioned }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    let worker: Worker | null = null;
    try {
      worker = await bootForkedWorker(pin);
      const arena = await provisionArena(worker);
      return { worker, arena };
    } catch (err) {
      lastErr = err;
      if (worker) await worker.tearDown().catch(() => {});
      worker = null;
      if (!isRetryable(err)) throw err;
      console.error(`transient sandbox/RPC failure on attempt ${i + 1}/${attempts}; retrying on a fresh worker`);
      await delay(15_000);
    }
  }
  throw lastErr;
}

export interface ArenaProvisioned {
  root: NearAccount;
  ft: NearAccount;
  owner: NearAccount;
  agent: NearAccount;
  wallet: NearAccount;
  attacker: NearAccount;
  recipient: NearAccount;
}

async function provisionArena(worker: Worker): Promise<ArenaProvisioned> {
  const root = worker.rootAccount;
  // Deterministic names, created sequentially (same keystore nonce slot — parallel
  // createSubAccount calls from one root race their nonces).
  const ft = await root.createSubAccount('ft');
  const owner = await root.createSubAccount('owner');
  const agent = await root.createSubAccount('agent');
  const wallet = await root.createSubAccount('wallet');
  const attacker = await root.createSubAccount('attacker');
  const recipient = await root.createSubAccount('recipient');
  await ft.deploy(readFileSync(FT_WASM));
  await ft.call(ft, 'new', {
    owner_id: owner.accountId,
    total_supply: TOTAL_SUPPLY.toString(),
    metadata: { spec: 'ft-1.0.0', name: 'Battery FT', symbol: 'BFT', decimals: 24, reference: null },
  });
  for (const account of [wallet, recipient, attacker]) {
    await account.call(ft, 'storage_deposit', { account_id: account.accountId }, { attachedDeposit: STORAGE_DEPOSIT });
  }
  await owner.call(ft, 'ft_transfer', { receiver_id: wallet.accountId, amount: FUND_WALLET.toString() }, { attachedDeposit: 1n });
  return { root, ft, owner, agent, wallet, attacker, recipient };
}
