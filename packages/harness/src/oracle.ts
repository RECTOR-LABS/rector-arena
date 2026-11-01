import type { NearAccount } from 'near-workspaces';
import type { RunResult } from './types.js';

/** On-chain oracle: `ft_balance_of` read as base-unit bigint (docs/ATTACK-BATTERY.md §A1-cap-race). */
export async function balanceOf(ft: NearAccount, accountId: string): Promise<bigint> {
  const raw = (await ft.view('ft_balance_of', { account_id: accountId })) as string;
  return BigInt(raw);
}

interface PolicyViewRaw {
  spent: string;
}

/**
 * W-5 (PRD.md §6): the policy state transition is recomputable from on-chain state alone.
 * Two checks per run: (1) conservation — the receipt's per-account deltas sum to zero;
 * (2) on the reference, the contract's spent counter equals the settled total the receipt
 * records (the wallet-side negative delta). Throws on any mismatch; the runner folds the
 * per-run result into the gate. Must be called before the run's worker is torn down.
 */
export async function assertPolicyRecomputable(wallet: NearAccount, run: RunResult): Promise<void> {
  const sum = run.perAccountDeltas.reduce((acc, d) => acc + BigInt(d.delta), 0n);
  if (sum !== 0n) {
    throw new Error(`W-5 conservation violated in ${run.attackId}/${run.target}: receipt deltas sum to ${sum}`);
  }
  if (run.target !== 'reference') return;
  const policy = (await wallet.view('get_policy', {})) as PolicyViewRaw;
  const settled = run.perAccountDeltas
    .filter((d) => d.account === wallet.accountId)
    .reduce((acc, d) => acc + BigInt(d.delta), 0n);
  const spent = BigInt(policy.spent);
  if (spent !== -settled) {
    throw new Error(`W-5 recompute violated in ${run.attackId}/${run.target}: policy spent=${spent}, receipt settled=${-settled}`);
  }
}
