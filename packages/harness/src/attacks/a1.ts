import { A1 } from '../config.js';
import { balanceOf } from '../oracle.js';
import type { ArenaEnv, ArenaTarget, RunResult } from '../types.js';

/**
 * A1-cap-race: velocity cap 100, 8 concurrent spends of 20 (total 160 > 100). Submission order
 * is preserved: outcomes[i] is spend i's terminal outcome. Settled total is the recipient's
 * on-chain FT delta (docs/ATTACK-BATTERY.md §A1-cap-race).
 */
export async function runA1(arena: ArenaEnv, target: ArenaTarget, targetId: 'gateway' | 'reference'): Promise<RunResult> {
  await target.setPolicy({
    velocityCap: A1.cap,
    receiverAllowlist: [arena.recipient.accountId],
    perIntentMax: null,
  });
  const keys = await target.provisionSpendKeys(A1.concurrency);

  const recipientBefore = await balanceOf(arena.ft, arena.recipient.accountId);

  const outcomes = await Promise.all(
    keys.map((key) => target.spend(arena.recipient.accountId, A1.spend, key)),
  );

  const settled = (await balanceOf(arena.ft, arena.recipient.accountId)) - recipientBefore;

  return {
    attackId: 'A1',
    target: targetId,
    verdict: settled > A1.cap ? 'fall' : 'hold',
    perAccountDeltas: [
      { account: target.walletId, token: 'battery-ft', delta: settled === 0n ? '0' : `-${settled}` },
      { account: arena.recipient.accountId, token: 'battery-ft', delta: settled.toString() },
    ],
    blockHeights: outcomes.map((o) => o.blockHeight),
    txHashes: outcomes.map((o) => o.txHash),
    moved: settled,
  };
}
