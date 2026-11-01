import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** 1 token = 1e24 base units (battery FT: 24 decimals). */
export const ONE_TOKEN = 10n ** 24n;
export const FUND_WALLET = 500n * ONE_TOKEN;
export const TOTAL_SUPPLY = 1_000_000_000_000_000_000_000_000_000n; // 1e27 base = 1000 tokens
export const STORAGE_DEPOSIT = 1_000_000_000_000_000_000_000_000n; // 1e24 yoctoNEAR, refundable

/** A1-cap-race: velocity cap 100, 8 concurrent spends of 20 (docs/ATTACK-BATTERY.md §A1-cap-race). */
export const A1 = {
  cap: 100n * ONE_TOKEN,
  spend: 20n * ONE_TOKEN,
  concurrency: 8,
} as const;

/**
 * A4-key-scope-escape: per-intent max 10 with allowlist {recipient}; the crafted escape moves
 * 50 to attacker. The velocity cap is generous — A4's envelope is allowlist + per-intent.
 */
export const A4 = {
  escape: 50n * ONE_TOKEN,
  perIntentMax: 10n * ONE_TOKEN,
  velocityCap: 1000n * ONE_TOKEN,
  fcAllowance: 10n ** 24n, // 1 token worth of gas allowance, above the attack's gas need
} as const;

/**
 * A2-freeze-bypass: one resting commitment of 25 registered while unfrozen; the owner
 * freezes; the trigger fires (docs/ATTACK-BATTERY.md §A2-freeze-bypass). The velocity cap
 * mirrors A1's 100 — the envelope is not the point here, the freeze is.
 */
export const A2 = {
  commitment: 25n * ONE_TOKEN,
  velocityCap: 100n * ONE_TOKEN,
} as const;

/**
 * A3-needs-review-double-spend: intent I settles 30 once; the identical retry after the
 * ambiguous first outcome must not re-settle (docs/ATTACK-BATTERY.md
 * §A3-needs-review-double-spend). The cap stays above 2×30 so nothing but idempotency can
 * block the double-settle.
 */
export const A3 = {
  once: 30n * ONE_TOKEN,
  velocityCap: 100n * ONE_TOKEN,
} as const;

export const SPEND_GAS = 120n * 10n ** 12n; // 120 TGas: contract attaches 50T to the ft_transfer promise

// rpc.mainnet.near.org is deprecated (429 + STOP-USING notice) and shares that fate with
// archival-rpc.mainnet.near.org, near-workspaces' default fork-data source. importContract
// resolves its provider through the NEAR_CLI_MAINNET_RPC_SERVER_URL hook, so point it at the
// recommended replacement (docs/ROADMAP.md §M0 spike record).
export const FORK_RPC = 'https://rpc.mainnet.fastnear.com';

export const ACCOUNT_NAMES = ['ft', 'owner', 'agent', 'wallet', 'attacker', 'recipient'] as const;

export const A1_SLUG = 'a1-cap-race';
export const A2_SLUG = 'a2-freeze-bypass';
export const A3_SLUG = 'a3-needs-review-double-spend';
export const A4_SLUG = 'a4-key-scope-escape';

/** Battery-owned NEP-141 token (near-sdk-rs 4.1.1 reference FT; vendor/PROVENANCE.md). */
export const FT_WASM = join(HERE, '..', 'vendor', 'ft.wasm');

/** Reference wallet wasm built by contracts/reference-wallet (`pnpm -r build`). */
export const REFERENCE_WASM = join(HERE, '..', '..', '..', 'contracts', 'reference-wallet', 'wasm', 'reference_wallet.wasm');

export const RECEIPTS_DIR = join(HERE, '..', '..', '..', 'receipts');
