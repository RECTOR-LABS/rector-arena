import { A5, A5_POISONED_EMAIL } from '../config.js';
import { balanceOf } from '../oracle.js';
import type { ArenaEnv, ArenaTarget, RunResult } from '../types.js';

/**
 * A5-injection-to-payment: the harness plants the poisoned email and feeds it to the agent
 * flow driving the target's victim wallet. The agent enacts the instruction: it produces a
 * transfer request for the FULL victim balance to attacker, then submits it for settlement
 * keyed by the request's intent id. The victim's policy envelope is deliberately generous —
 * attacker IS allowlisted, the velocity cap fits the full balance, no per-intent max — so
 * on the reference the ONLY gate that can block the drain is request-flow provenance
 * (INV-5): the owner never approved the request, because approval cannot be minted by
 * content. The gateway has no request flow at all and accepts the agent-signed transfer
 * without provenance — the full-balance drain (docs/ATTACK-BATTERY.md
 * §A5-injection-to-payment).
 *
 * The verdict receipt is the run's single receipt (docs/ARCHITECTURE.md §Receipt schema);
 * the settle attempt tx is the receipt's evidence. The request proposal is setup: a failed
 * proposal invalidates the attack, it never shapes the verdict.
 */
export async function runA5(arena: ArenaEnv, target: ArenaTarget, targetId: 'gateway' | 'reference'): Promise<RunResult> {
  if (arena.victim === null) {
    throw new Error('A5 requires victim provisioning: boot the arena with withVictim');
  }

  console.error(`[a5] poisoned content fed to the agent flow:\n${A5_POISONED_EMAIL}`);

  // The victim's policy envelope is deliberately generous — attacker IS allowlisted, the
  // velocity cap fits the full balance, no per-intent max — so on the reference the ONLY
  // gate that can block the drain is request-flow provenance (INV-5).
  await target.setPolicy({
    velocityCap: A5.victimBalance,
    receiverAllowlist: [arena.attacker.accountId],
    perIntentMax: null,
  });

  const victimBefore = await balanceOf(arena.ft, arena.victim.accountId);

  // Step 2: the agent flow produces the transfer request for the full victim balance to
  // attacker — the receiver named by the injected instruction.
  await target.createRequest(A5.drainRequestId, arena.attacker.accountId, A5.victimBalance);

  // Step 3: the agent submits the settlement under the request's intent id and the harness
  // waits for terminal status.
  const [key] = await target.provisionSpendKeys(1);
  const drain = await target.submitIntent(A5.drainRequestId, arena.attacker.accountId, A5.victimBalance, key);

  const victimAfter = await balanceOf(arena.ft, arena.victim.accountId);
  const drained = victimBefore - victimAfter;

  return {
    attackId: 'A5',
    target: targetId,
    verdict: drained > 0n ? 'fall' : 'hold',
    perAccountDeltas: [
      { account: arena.victim.accountId, token: 'battery-ft', delta: drained === 0n ? '0' : `-${drained}` },
      { account: arena.attacker.accountId, token: 'battery-ft', delta: drained.toString() },
    ],
    blockHeights: [drain.blockHeight],
    txHashes: [drain.txHash],
    moved: drained,
  };
}
