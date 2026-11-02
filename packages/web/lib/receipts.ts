import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { AttestationState } from "./attest";

// Receipts are copied into public/receipts by scripts/copy-receipts.mjs (chained
// into dev/build), so the same path serves local dev and a hosted deploy.
const RECEIPTS_DIR = path.resolve(process.cwd(), "public", "receipts");

const ATTACKS = [
  { id: "A1", slug: "a1-cap-race", name: "cap race" },
  { id: "A2", slug: "a2-freeze-bypass", name: "freeze bypass" },
  { id: "A3", slug: "a3-needs-review-double-spend", name: "needs-review double spend" },
  { id: "A4", slug: "a4-key-scope-escape", name: "key scope escape" },
  { id: "A5", slug: "a5-injection-to-payment", name: "injection to payment" },
] as const;

const TARGETS = ["gateway", "reference"] as const;

type Target = (typeof TARGETS)[number];

export interface AccountDelta {
  account: string;
  token: string;
  delta: string;
}

export interface Receipt {
  attackId: string;
  target: Target;
  verdict: string;
  perAccountDeltas: AccountDelta[];
  ranAt: string;
  verdictHash: string;
}

export interface ReceiptCell extends Receipt {
  /** Repo-root-relative path of the receipt file, used as link text. */
  repoPath: string;
  /** True when sha256 of the canonical core equals the file's verdict_hash. */
  integrityOk: boolean;
  /** Filled in by the page after the on-chain attestation query. */
  attestation?: AttestationState;
}

export interface AttackRow {
  id: string;
  name: string;
  cells: { gateway: ReceiptCell | null; reference: ReceiptCell | null };
}

interface RawReceipt {
  attack_id: unknown;
  target: unknown;
  verdict: unknown;
  per_account_deltas: unknown;
  ran_at: unknown;
  verdict_hash: unknown;
}

function isTarget(value: unknown): value is Target {
  return (TARGETS as readonly string[]).includes(value as string);
}

function isAccountDelta(value: unknown): value is AccountDelta {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.account === "string" &&
    typeof d.token === "string" &&
    typeof d.delta === "string"
  );
}

function parseReceipt(raw: unknown, attackId: string, target: Target): Receipt {
  const r = raw as RawReceipt;
  if (r.attack_id !== attackId) {
    throw new Error(`attack_id mismatch: expected ${attackId}, got ${String(r.attack_id)}`);
  }
  if (r.target !== target) {
    throw new Error(`target mismatch: expected ${target}, got ${String(r.target)}`);
  }
  if (typeof r.verdict !== "string") throw new Error("verdict missing");
  if (!Array.isArray(r.per_account_deltas) || !r.per_account_deltas.every(isAccountDelta)) {
    throw new Error("per_account_deltas missing or malformed");
  }
  if (typeof r.ran_at !== "string") throw new Error("ran_at missing");
  if (typeof r.verdict_hash !== "string") throw new Error("verdict_hash missing");
  return {
    attackId,
    target,
    verdict: r.verdict,
    perAccountDeltas: r.per_account_deltas,
    ranAt: r.ran_at,
    verdictHash: r.verdict_hash,
  };
}

/**
 * verdict_hash = sha256 hex of EXACTLY JSON.stringify of the canonical core in
 * this key order; per_account_deltas entries keep the file's own key order.
 */
function canonicalHash(receipt: Receipt): string {
  const core = {
    attack_id: receipt.attackId,
    target: receipt.target,
    verdict: receipt.verdict,
    per_account_deltas: receipt.perAccountDeltas,
  };
  return createHash("sha256").update(JSON.stringify(core)).digest("hex");
}

/** Base-unit string -> human token amount (FT has 24 decimals), sign kept. */
export function humanizeDelta(delta: string): string {
  const negative = delta.startsWith("-");
  const abs = BigInt(negative ? delta.slice(1) : delta);
  const whole = abs / 10n ** 24n;
  const frac = (abs % 10n ** 24n).toString().padStart(24, "0").replace(/0+$/, "");
  const human = frac ? `${whole}.${frac}` : whole.toString();
  return negative ? `-${human}` : human;
}

/** Total settled out of the wallet: sum of |negative deltas|, humanized. */
export function settledTotal(receipt: Receipt): string {
  let outflow = 0n;
  for (const d of receipt.perAccountDeltas) {
    const value = BigInt(d.delta);
    if (value < 0n) outflow += -value;
  }
  return humanizeDelta(outflow.toString());
}

async function readReceipt(slug: string, attackId: string, file: string): Promise<ReceiptCell> {
  const target = TARGETS.find((t) => file.startsWith(`${t}-`) && file.endsWith(".json"));
  if (!target) throw new Error(`unrecognized receipt filename: ${file}`);
  const raw: unknown = JSON.parse(await readFile(path.join(RECEIPTS_DIR, slug, file), "utf8"));
  const receipt = parseReceipt(raw, attackId, target);
  const repoPath = `receipts/${slug}/${file}`;
  return { ...receipt, repoPath, integrityOk: canonicalHash(receipt) === receipt.verdictHash };
}

export async function loadAttackRows(): Promise<AttackRow[]> {
  const rows: AttackRow[] = [];
  for (const attack of ATTACKS) {
    const cells: AttackRow["cells"] = { gateway: null, reference: null };
    let files: string[] = [];
    try {
      files = (await readdir(path.join(RECEIPTS_DIR, attack.slug))).sort();
    } catch {
      files = [];
    }
    for (const file of files) {
      const cell = await readReceipt(attack.slug, attack.id, file);
      cells[cell.target] = cell;
    }
    rows.push({ id: attack.id, name: attack.name, cells });
  }
  return rows;
}
