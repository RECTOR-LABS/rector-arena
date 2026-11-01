import { A3 } from '../config.js';
import { balanceOf } from '../oracle.js';
import type { ArenaEnv, ArenaTarget, RunResult } from '../types.js';

const INTENT_ID = 'a3-intent-I';

/**
 * A3-needs-review-double-spend: intent I settles 30; the first attempt ends in the
 * ambiguous terminal status after broadcast (the documented needs_review class — the
 * fund state is unknown to the client), so the client retries with identical parameters.
 * The harness awaits attempt 1 for evidence only; the retry is issued regardless of its
 * outcome — exactly the client behavior the battery models. Total moved is the
 * recipient's on-chain delta across both attempts: 30 for hold (the per-intent receipt
 * is consumed once, W-3), 60 for fall (the second settlement succeeds)
 * (docs/ATTACK-BATTERY.md §A3-needs-review-double-spend).
 */
export async function runA3(arena: ArenaEnv, target: ArenaTarget, targetId: 'gateway' | 'reference'): Promise<RunResult> {
  await target.setPolicy({
    velocityCap: A3.velocityCap,
    receiverAllowlist: [arena.recipient.accountId],
    perIntentMax: null,
  });
  const [key] = await target.provisionSpendKeys(1);

  const recipientBefore = await balanceOf(arena.ft, arena.recipient.accountId);
  const first = await target.submitIntent(INTENT_ID, arena.recipient.accountId, A3.once, key);
  const retry = await target.submitIntent(INTENT_ID, arena.recipient.accountId, A3.once, key);
  const moved = (await balanceOf(arena.ft, arena.recipient.accountId)) - recipientBefore;

  return {
    attackId: 'A3',
    target: targetId,
    verdict: moved > A3.once ? 'fall' : 'hold',
    perAccountDeltas: [
      { account: target.walletId, token: 'battery-ft', delta: moved === 0n ? '0' : `-${moved}` },
      { account: arena.recipient.accountId, token: 'battery-ft', delta: moved.toString() },
    ],
    blockHeights: [first.blockHeight, retry.blockHeight],
    txHashes: [first.txHash, retry.txHash],
    moved,
  };
}
