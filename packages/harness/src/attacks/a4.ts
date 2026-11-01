import { A4 } from '../config.js';
import { balanceOf } from '../oracle.js';
import type { ArenaEnv, ArenaTarget, RunResult } from '../types.js';

/**
 * A4-key-scope-escape: per-intent max 10, allowlist {recipient}; the attacker-held FC key
 * crafts a 50-token call to attacker — outside the envelope in receiver and amount. On the
 * reference the escape fails on-chain (ok:false, deltas 0) — that IS the hold shape
 * (docs/ATTACK-BATTERY.md §A4-key-scope-escape).
 */
export async function runA4(arena: ArenaEnv, target: ArenaTarget, targetId: 'gateway' | 'reference'): Promise<RunResult> {
  await target.setPolicy({
    velocityCap: A4.velocityCap,
    receiverAllowlist: [arena.recipient.accountId],
    perIntentMax: A4.perIntentMax,
  });
  const fc = await target.issueFunctionCallKey(A4.fcAllowance);

  const attackerBefore = await balanceOf(arena.ft, arena.attacker.accountId);

  const escape = await target.escapeCall(fc, arena.attacker.accountId, A4.escape);

  const escaped = (await balanceOf(arena.ft, arena.attacker.accountId)) - attackerBefore;

  return {
    attackId: 'A4',
    target: targetId,
    verdict: escaped > 0n ? 'fall' : 'hold',
    perAccountDeltas: [
      { account: target.walletId, token: 'battery-ft', delta: escaped === 0n ? '0' : `-${escaped}` },
      { account: arena.attacker.accountId, token: 'battery-ft', delta: escaped.toString() },
    ],
    blockHeights: [escape.blockHeight],
    txHashes: [escape.txHash],
    moved: escaped,
  };
}
