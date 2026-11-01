import type { Worker } from 'near-workspaces';
import { postAttest } from './attest.js';
import { runA1 } from './attacks/a1.js';
import { runA2 } from './attacks/a2.js';
import { runA3 } from './attacks/a3.js';
import { runA4 } from './attacks/a4.js';
import { runA5 } from './attacks/a5.js';
import { A1, A1_SLUG, A2, A2_SLUG, A3, A3_SLUG, A4, A4_SLUG, A5, A5_SLUG, ONE_TOKEN } from './config.js';
import { bootForkedArena, pinBlockHeight } from './env.js';
import type { ArenaProvisioned, ForkPin } from './env.js';
import { assertPolicyRecomputable } from './oracle.js';
import { readReceipts, verdictHash, writeReceipt } from './receipt.js';
import type { Receipt } from './receipt.js';
import { GatewayTargetAdapter } from './targets/gateway.js';
import { ReferenceTarget } from './targets/reference.js';
import type { ArenaTarget, RunResult } from './types.js';

type TargetId = 'gateway' | 'reference';

function usageFail(): never {
  console.error('usage: pnpm arena:run  (full battery, both targets)  |  ARENA_TARGET=gateway|reference pnpm arena:run');
  process.exit(2);
}

interface Booted {
  target: ArenaTarget;
  arena: ArenaProvisioned;
  worker: Worker;
}

async function bootTarget(pin: ForkPin, targetId: TargetId, opts: { withVictim?: boolean } = {}): Promise<Booted> {
  const { worker, arena } = await bootForkedArena(pin, { withVictim: opts.withVictim === true });
  const at = opts.withVictim === true ? requireVictim(arena) : arena.wallet;
  const target = targetId === 'gateway' ? await GatewayTargetAdapter.boot(arena, at) : await ReferenceTarget.boot(arena, at);
  return { target, arena, worker };
}

function requireVictim(arena: ArenaProvisioned): NonNullable<ArenaProvisioned['victim']> {
  if (arena.victim === null) throw new Error('A5 requires victim provisioning: boot with withVictim');
  return arena.victim;
}

/** Receipt deltas are base-unit strings; the negative entry is the wallet, the positive one is the receiver. */
function settledFromReceipt(r: { per_account_deltas: Array<{ delta: string }> }): bigint {
  const positive = r.per_account_deltas.map((d) => d.delta).find((d) => !d.startsWith('-'));
  return BigInt(positive ?? '0');
}

/** Write the receipt; when attestation is on, post the attest tx and surface its hash. */
async function writeAndMaybeAttest(run: RunResult): Promise<{ path: string; receipt: Receipt; attestTx: string | null }> {
  const written = writeReceipt(run);
  if (process.env.ARENA_ATTEST !== '1') {
    return { path: written.path, receipt: written.receipt, attestTx: null };
  }
  const attestTx = await postAttest(written.receipt);
  console.error(`attested ${run.attackId}/${run.target} → tx ${attestTx}`);
  return { path: written.path, receipt: written.receipt, attestTx };
}

/** One W-5 recompute per run; a mismatch fails the gate, it never aborts the battery. */
async function checkW5(wallet: ArenaProvisioned['wallet'] | NonNullable<ArenaProvisioned['victim']>, run: RunResult): Promise<boolean> {
  try {
    await assertPolicyRecomputable(wallet, run);
    return true;
  } catch (err) {
    console.error(String(err));
    return false;
  }
}

interface TargetRun {
  gate: boolean;
  receipts: number;
}

/** One target's battery: A1..A5 + the FR-11 double-run probe, 5 receipts, pairs + W-5 + SC-2. */
async function runTarget(targetId: TargetId, pin: ForkPin): Promise<TargetRun> {
  const out = (k: string, v: string): void => console.log(`${k}=${v}`);
  out('target', targetId);
  out('fork_block_height', String(pin.height));

  // (1) A1 on the target.
  const a1Boot = await bootTarget(pin, targetId);
  const a1 = await runA1(a1Boot.arena, a1Boot.target, targetId);
  const a1W5 = await checkW5(a1Boot.arena.wallet, a1);
  await a1Boot.worker.tearDown();
  const a1Written = await writeAndMaybeAttest(a1);

  // (2) FR-11: A1 again on a fresh fork at the same pinned height, in memory only.
  const fr11Boot = await bootTarget(pin, targetId);
  const a1Again = await runA1(fr11Boot.arena, fr11Boot.target, targetId);
  await fr11Boot.worker.tearDown();
  const fr11Equal = verdictHash(a1) === verdictHash(a1Again);

  // (3) A2 on a fresh fork.
  const a2Boot = await bootTarget(pin, targetId);
  const a2 = await runA2(a2Boot.arena, a2Boot.target, targetId);
  const a2W5 = await checkW5(a2Boot.arena.wallet, a2);
  await a2Boot.worker.tearDown();
  const a2Written = await writeAndMaybeAttest(a2);

  // (4) A3 on a fresh fork.
  const a3Boot = await bootTarget(pin, targetId);
  const a3 = await runA3(a3Boot.arena, a3Boot.target, targetId);
  const a3W5 = await checkW5(a3Boot.arena.wallet, a3);
  await a3Boot.worker.tearDown();
  const a3Written = await writeAndMaybeAttest(a3);

  // (5) A4 on a fresh fork.
  const a4Boot = await bootTarget(pin, targetId);
  const a4 = await runA4(a4Boot.arena, a4Boot.target, targetId);
  const a4W5 = await checkW5(a4Boot.arena.wallet, a4);
  await a4Boot.worker.tearDown();
  const a4Written = await writeAndMaybeAttest(a4);

  // (6) A5 on a fresh fork, against the VICTIM wallet (the A5-only provisioned target).
  const a5Boot = await bootTarget(pin, targetId, { withVictim: true });
  const victim = requireVictim(a5Boot.arena);
  const a5 = await runA5(a5Boot.arena, a5Boot.target, targetId);
  const a5W5 = await checkW5(victim, a5);
  await a5Boot.worker.tearDown();
  const a5Written = await writeAndMaybeAttest(a5);

  // (7) Oracle pair: compare against the counterpart target's receipts on disk (any prior run).
  const other: TargetId = targetId === 'gateway' ? 'reference' : 'gateway';
  // Expected settled/moved per target: gateway falls (160 > 100 cap; the resting order pays
  // 25 post-freeze; the intent settles twice = 60; the escape settles 50; the unapproved
  // drain pays the full victim balance), reference holds (exactly 100; post-freeze 0;
  // exactly once 30; escape 0; drain 0).
  const expected: Record<string, Record<TargetId, bigint>> = {
    [A1_SLUG]: { gateway: 160n * ONE_TOKEN, reference: A1.cap },
    [A2_SLUG]: { gateway: A2.commitment, reference: 0n },
    [A3_SLUG]: { gateway: 2n * A3.once, reference: A3.once },
    [A4_SLUG]: { gateway: A4.escape, reference: 0n },
    [A5_SLUG]: { gateway: A5.victimBalance, reference: 0n },
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
  const a5Pair = pair(A5_SLUG, a5.moved);

  // (8) Verdict semantics: gateway requires fall, reference requires hold.
  const wantVerdict: 'fall' | 'hold' = targetId === 'gateway' ? 'fall' : 'hold';
  const verdictsOk =
    a1.verdict === wantVerdict && a2.verdict === wantVerdict && a3.verdict === wantVerdict && a4.verdict === wantVerdict && a5.verdict === wantVerdict;

  // (9) W-5 across the battery (PRD.md §6): the policy state transition is recomputable
  // from on-chain state + receipts for every run of this target.
  const w5Ok = a1W5 && a2W5 && a3W5 && a4W5 && a5W5;

  // (10) SC-2 (PRD.md §7): the reference preserves INV-1..INV-5 under the full battery.
  // The gateway run has no on-chain policy engine — SC-2 is reference-scoped.
  const sc2Checks: Array<[string, boolean]> = [
    ['INV-1', a1.moved <= A1.cap],
    ['INV-2', a2.moved === 0n],
    ['INV-3', a3.moved === A3.once],
    ['INV-4', a4.moved === 0n],
    ['INV-5', a5.moved === 0n],
  ];
  const sc2Ok = sc2Checks.every(([, ok]) => ok);

  const gate = verdictsOk && fr11Equal && w5Ok && (targetId === 'gateway' || sc2Ok);

  out('a1_settled_tokens', String(a1.moved / ONE_TOKEN));
  out('a1_verdict', a1.verdict);
  out('a1_receipt', a1Written.path);
  if (a1Written.attestTx !== null) out('a1_attest_tx', a1Written.attestTx);
  out('a2_settled_tokens', String(a2.moved / ONE_TOKEN));
  out('a2_verdict', a2.verdict);
  out('a2_receipt', a2Written.path);
  if (a2Written.attestTx !== null) out('a2_attest_tx', a2Written.attestTx);
  out('a3_moved_tokens', String(a3.moved / ONE_TOKEN));
  out('a3_verdict', a3.verdict);
  out('a3_receipt', a3Written.path);
  if (a3Written.attestTx !== null) out('a3_attest_tx', a3Written.attestTx);
  out('a4_escaped_tokens', String(a4.moved / ONE_TOKEN));
  out('a4_verdict', a4.verdict);
  out('a4_receipt', a4Written.path);
  if (a4Written.attestTx !== null) out('a4_attest_tx', a4Written.attestTx);
  out('a5_drained_tokens', String(a5.moved / ONE_TOKEN));
  out('a5_verdict', a5.verdict);
  out('a5_receipt', a5Written.path);
  if (a5Written.attestTx !== null) out('a5_attest_tx', a5Written.attestTx);
  out('fr11', fr11Equal ? 'equal' : 'unequal');
  out('fr11_verdict_hash', verdictHash(a1));
  out('pair', `a1:${a1Pair};a2:${a2Pair};a3:${a3Pair};a4:${a4Pair};a5:${a5Pair}`);
  out('w5', w5Ok ? 'ok' : 'FAIL');
  out('sc2', targetId === 'gateway' ? 'n/a' : sc2Ok ? 'ok' : `FAIL: ${sc2Checks.filter(([, ok]) => !ok).map(([id]) => id).join(',')}`);
  out('run_verdicts', verdictsOk ? 'ok' : 'FAIL');
  out(
    'gate',
    gate
      ? 'PASS'
      : `FAIL: run_verdicts=${verdictsOk ? 'ok' : 'FAIL'} fr11=${fr11Equal ? 'equal' : 'unequal'} w5=${w5Ok ? 'ok' : 'FAIL'}${
          targetId === 'gateway' ? '' : ` sc2=${sc2Ok ? 'ok' : 'FAIL'}`
        }`,
  );
  return { gate, receipts: 5 };
}

async function main(): Promise<void> {
  const raw = process.env.ARENA_TARGET;
  // Targets registry (docs/ATTACK-BATTERY.md): a set-but-unknown value aborts BEFORE any
  // account creation; unset/empty runs the full battery (SC-1) across both targets.
  if (raw !== undefined && raw !== '' && raw !== 'gateway' && raw !== 'reference') usageFail();

  if (raw === 'gateway' || raw === 'reference') {
    const pin = await pinBlockHeight();
    console.error(`fork pinned: ${pin.network} @ ${pin.height}`);
    const run = await runTarget(raw, pin);
    if (!run.gate) process.exitCode = 1;
    return;
  }

  const pin = await pinBlockHeight();
  console.error(`fork pinned: ${pin.network} @ ${pin.height}`);
  const gateway = await runTarget('gateway', pin);
  const reference = await runTarget('reference', pin);
  const gate = gateway.gate && reference.gate;
  console.log(`receipts=${gateway.receipts + reference.receipts}`);
  console.log(`full_battery_gate=${gate ? 'PASS' : 'FAIL'}`);
  if (!gate) process.exitCode = 1;
}

await main();
