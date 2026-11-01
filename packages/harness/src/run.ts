import type { Worker } from 'near-workspaces';
import { runA1 } from './attacks/a1.js';
import { runA2 } from './attacks/a2.js';
import { runA3 } from './attacks/a3.js';
import { runA4 } from './attacks/a4.js';
import { A1, A1_SLUG, A2, A2_SLUG, A3, A3_SLUG, A4, A4_SLUG, ONE_TOKEN } from './config.js';
import { bootForkedArena, pinBlockHeight } from './env.js';
import type { ArenaProvisioned, ForkPin } from './env.js';
import { readReceipts, verdictHash, writeReceipt } from './receipt.js';
import { GatewayTargetAdapter } from './targets/gateway.js';
import { ReferenceTarget } from './targets/reference.js';
import type { ArenaTarget, RunResult } from './types.js';

type TargetId = 'gateway' | 'reference';

function usageFail(): never {
  console.error('usage: ARENA_TARGET=gateway|reference pnpm arena:run');
  process.exit(2);
}

interface Booted {
  target: ArenaTarget;
  arena: ArenaProvisioned;
  worker: Worker;
}

async function bootTarget(pin: ForkPin, targetId: TargetId): Promise<Booted> {
  const { worker, arena } = await bootForkedArena(pin);
  const target = targetId === 'gateway' ? await GatewayTargetAdapter.boot(arena) : await ReferenceTarget.boot(arena);
  return { target, arena, worker };
}

/** Receipt deltas are base-unit strings; the negative entry is the wallet, the positive one is the receiver. */
function settledFromReceipt(r: { per_account_deltas: Array<{ delta: string }> }): bigint {
  const positive = r.per_account_deltas.map((d) => d.delta).find((d) => !d.startsWith('-'));
  return BigInt(positive ?? '0');
}

async function main(): Promise<void> {
  const raw = process.env.ARENA_TARGET;
  // Targets registry (docs/ATTACK-BATTERY.md): abort BEFORE any account creation.
  if (raw !== 'gateway' && raw !== 'reference') usageFail();
  const targetId: TargetId = raw;

  const pin = await pinBlockHeight();
  console.error(`fork pinned: ${pin.network} @ ${pin.height}`);

  // (4) A1 on the target.
  const a1Boot = await bootTarget(pin, targetId);
  const a1 = await runA1(a1Boot.arena, a1Boot.target, targetId);
  await a1Boot.worker.tearDown();
  const a1Written = writeReceipt(a1);

  // (5) FR-11: A1 again on a fresh fork at the same pinned height, in memory only.
  const fr11Boot = await bootTarget(pin, targetId);
  const a1Again = await runA1(fr11Boot.arena, fr11Boot.target, targetId);
  await fr11Boot.worker.tearDown();
  const fr11Equal = verdictHash(a1) === verdictHash(a1Again);

  // (6) A2 on a fresh fork.
  const a2Boot = await bootTarget(pin, targetId);
  const a2 = await runA2(a2Boot.arena, a2Boot.target, targetId);
  await a2Boot.worker.tearDown();
  const a2Written = writeReceipt(a2);

  // (7) A3 on a fresh fork.
  const a3Boot = await bootTarget(pin, targetId);
  const a3 = await runA3(a3Boot.arena, a3Boot.target, targetId);
  await a3Boot.worker.tearDown();
  const a3Written = writeReceipt(a3);

  // (8) A4 on a fresh fork.
  const a4Boot = await bootTarget(pin, targetId);
  const a4 = await runA4(a4Boot.arena, a4Boot.target, targetId);
  await a4Boot.worker.tearDown();
  const a4Written = writeReceipt(a4);

  // (9) Oracle pair: compare against the counterpart target's receipts on disk (any prior run).
  const other: TargetId = targetId === 'gateway' ? 'reference' : 'gateway';
  // Expected settled/moved per target: gateway falls (160 > 100 cap; the resting order pays
  // 25 post-freeze; the intent settles twice = 60; the escape settles 50), reference holds
  // (exactly 100; post-freeze 0; exactly once 30; escape 0).
  const expected: Record<string, Record<TargetId, bigint>> = {
    [A1_SLUG]: { gateway: 160n * ONE_TOKEN, reference: A1.cap },
    [A2_SLUG]: { gateway: A2.commitment, reference: 0n },
    [A3_SLUG]: { gateway: 2n * A3.once, reference: A3.once },
    [A4_SLUG]: { gateway: A4.escape, reference: 0n },
  };
  const pair = (slug: string, selfMoved: bigint): 'ok' | 'pending' => {
    const counterparts = readReceipts(slug, other);
    if (counterparts.length === 0) return 'pending';
    return selfMoved === expected[slug][targetId] && settledFromReceipt(counterparts[0]) === expected[slug][other] ? 'ok' : 'pending';
  };
  const a1Pair = pair(A1_SLUG, a1.moved);
  const a2Pair = pair(A2_SLUG, a2.moved);
  const a3Pair = pair(A3_SLUG, a3.moved);
  const a4Pair = pair(A4_SLUG, a4.moved);

  // (10) Verdict semantics: gateway requires fall, reference requires hold.
  const wantVerdict: 'fall' | 'hold' = targetId === 'gateway' ? 'fall' : 'hold';
  const verdictsOk =
    a1.verdict === wantVerdict && a2.verdict === wantVerdict && a3.verdict === wantVerdict && a4.verdict === wantVerdict;
  const gate = verdictsOk && fr11Equal;

  const out = (k: string, v: string): void => console.log(`${k}=${v}`);
  out('target', targetId);
  out('fork_block_height', String(pin.height));
  out('a1_settled_tokens', String(a1.moved / ONE_TOKEN));
  out('a1_verdict', a1.verdict);
  out('a1_receipt', a1Written.path);
  out('a2_settled_tokens', String(a2.moved / ONE_TOKEN));
  out('a2_verdict', a2.verdict);
  out('a2_receipt', a2Written.path);
  out('a3_moved_tokens', String(a3.moved / ONE_TOKEN));
  out('a3_verdict', a3.verdict);
  out('a3_receipt', a3Written.path);
  out('a4_escaped_tokens', String(a4.moved / ONE_TOKEN));
  out('a4_verdict', a4.verdict);
  out('a4_receipt', a4Written.path);
  out('fr11', fr11Equal ? 'equal' : 'unequal');
  out('fr11_verdict_hash', verdictHash(a1));
  out('pair', `a1:${a1Pair};a2:${a2Pair};a3:${a3Pair};a4:${a4Pair}`);
  out('run_verdicts', verdictsOk ? 'ok' : 'FAIL');
  out('gate', gate ? 'PASS' : `FAIL: run_verdicts=${verdictsOk ? 'ok' : 'FAIL'} fr11=${fr11Equal ? 'equal' : 'unequal'}`);
  if (!gate) process.exitCode = 1;
}

await main();
