import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { A1_SLUG, A2_SLUG, A3_SLUG, A4_SLUG, A5_SLUG, RECEIPTS_DIR } from './config.js';
import type { RunResult } from './types.js';

export type ReceiptCore = Pick<RunResult, 'attackId' | 'target' | 'verdict' | 'perAccountDeltas' | 'blockHeights'>;

export interface Receipt {
  attack_id: string;
  target: string;
  verdict: string;
  per_account_deltas: Array<{ account: string; token: string; delta: string }>;
  block_heights: number[];
  tx_hashes: string[];
  ran_at: string;
  verdict_hash: string;
}

/** SHA-256 over the M0-pinned canonical core: every §Receipt-schema field except ran_at and tx_hashes, exact order. */
export function verdictHash(core: ReceiptCore): string {
  const canonical = {
    attack_id: core.attackId,
    target: core.target,
    verdict: core.verdict,
    per_account_deltas: core.perAccountDeltas,
    block_heights: core.blockHeights,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function runId(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildReceipt(run: RunResult): Receipt {
  return {
    attack_id: run.attackId,
    target: run.target,
    verdict: run.verdict,
    per_account_deltas: run.perAccountDeltas,
    block_heights: run.blockHeights,
    tx_hashes: run.txHashes,
    ran_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    verdict_hash: verdictHash(run),
  };
}

const SLUGS: Record<RunResult['attackId'], string> = { A1: A1_SLUG, A2: A2_SLUG, A3: A3_SLUG, A4: A4_SLUG, A5: A5_SLUG };

export function receiptPath(run: RunResult, id: string): string {
  return join(RECEIPTS_DIR, SLUGS[run.attackId], `${run.target}-${id}.json`);
}

export function writeReceipt(run: RunResult): { path: string; receipt: Receipt } {
  const id = runId();
  const path = receiptPath(run, id);
  mkdirSync(join(path, '..'), { recursive: true });
  const receipt = buildReceipt(run);
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return { path, receipt };
}

/** Read every receipt on disk for (slug, target) across all prior runs. */
export function readReceipts(slug: string, target: string): Receipt[] {
  const dir = join(RECEIPTS_DIR, slug);
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return [];
  }
  const out: Receipt[] = [];
  for (const name of names) {
    if (!name.startsWith(`${target}-`) || !name.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(readFileSync(join(dir, name), 'utf8')) as Receipt);
    } catch {
      // Unreadable receipts cannot contribute to the pair check.
    }
  }
  return out;
}
