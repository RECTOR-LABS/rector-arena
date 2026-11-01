import { A2 } from '../config.js';
import { balanceOf } from '../oracle.js';
import type { ArenaEnv, ArenaTarget, RunResult } from '../types.js';

const COMMITMENT_ID = 'a2-resting-1';

/**
 * A2-freeze-bypass: one resting commitment of 25 registered while unfrozen; the owner
 * freezes; the trigger condition fires. The oracle reads the post-freeze settled total
 * from the recipient's on-chain delta — 0 for hold (freeze cancels outstanding
 * commitments, W-2), 25 for fall (the resting order pays after the freeze). Commitment
 * registration and the freeze are setup, not settle attempts: the receipt's tx evidence
 * is the trigger firing only (docs/ATTACK-BATTERY.md §A2-freeze-bypass).
 */
export async function runA2(arena: ArenaEnv, target: ArenaTarget, targetId: 'gateway' | 'reference'): Promise<RunResult> {
  await target.setPolicy({
    velocityCap: A2.velocityCap,
    receiverAllowlist: [arena.recipient.accountId],
    perIntentMax: null,
  });
  await target.createCommitment(COMMITMENT_ID, arena.recipient.accountId, A2.commitment);
  await target.freeze();

  const recipientBefore = await balanceOf(arena.ft, arena.recipient.accountId);
  const fired = await target.fireTrigger();
  const settled = (await balanceOf(arena.ft, arena.recipient.accountId)) - recipientBefore;

  return {
    attackId: 'A2',
    target: targetId,
    verdict: settled > 0n ? 'fall' : 'hold',
    perAccountDeltas: [
      { account: target.walletId, token: 'battery-ft', delta: settled === 0n ? '0' : `-${settled}` },
      { account: arena.recipient.accountId, token: 'battery-ft', delta: settled.toString() },
    ],
    blockHeights: fired.map((o) => o.blockHeight),
    txHashes: fired.map((o) => o.txHash),
    moved: settled,
  };
}
