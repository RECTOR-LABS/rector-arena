# M1 — harness + gateway falls

| Field | Value |
|-------|-------|
| Milestone | M1 — harness + gateway falls |
| Window (UTC) | 2026-11-02 → 2026-11-05 |
| Closes | FR-1, FR-2, FR-5, FR-7, FR-9, FR-11; W-1, W-4 |
| Acceptance authority | docs/ROADMAP.md row M1 |

Execution spec for M1. Subordinate to docs/ROADMAP.md row M1; on any conflict ROADMAP wins. Citations follow PRD.md §0(f): IDs and §anchors, never restated canonical content.

## Objective

The harness runs A1 + A4 against both targets: `gateway-replica` falls, the reference first-pass holds (W-1, W-4), and every run writes a receipt. The battery produces its first receipts and its first oracle pair.

## Prerequisites

M0 closed: docs/ROADMAP.md §M0 spike record is filled — fork decided, per-tx p95 and startup within the row M0 gate, near-workspaces pin recorded, FR-11 canonical core pinned.

## Work breakdown

Steps run in order. Each names its action and its done-condition.

1. **Scaffold the monorepo packages.** Create `packages/harness/`, `targets/gateway-replica/`, `contracts/reference-wallet/`, `receipts/` per docs/ARCHITECTURE.md §Package tree. — Done: `pnpm install && pnpm -r build` exits 0.
2. **Build the harness core.** `ARENA_TARGET` dispatch per docs/ATTACK-BATTERY.md §Targets registry (`gateway` → `targets/gateway-replica`, `reference` → `contracts/reference-wallet`; any other value or unset aborts with a usage error before any account is created). Provision the run accounts `owner`, `agent`, `wallet`, `attacker`, `recipient` per docs/ATTACK-BATTERY.md §Shared environment — `victim` is A5-only (§Shared environment) and is not provisioned at M1. Deploy the battery FT (24 decimals, §Shared environment). Pin the near-workspaces version from docs/ROADMAP.md §M0 spike record in `packages/harness/package.json`. — Done: empty and unknown `ARENA_TARGET` values abort before account creation; the five accounts provision per run; the pin equals the recorded M0 value.
3. **Build the receipt writer.** Fields per docs/ARCHITECTURE.md §Receipt schema. Path `receipts/<attack-slug>/<target>-<run_id>.json` with the lowercase attack slug as directory component (`receipts/a1-cap-race/gateway-<run_id>.json`), the path form of the `Evidence` lines in docs/ATTACK-BATTERY.md §A1-cap-race through §A5-injection-to-payment; the JSON `attack_id` field keeps the registry ID (`A1`..`A5`). `verdict_hash` = SHA-256 over the M0-pinned canonical core (every §Receipt-schema field except `ran_at` and `tx_hashes`; docs/ROADMAP.md §M0 spike record). — Done: every completed run writes one JSON that validates against §Receipt schema.
4. **Build `gateway-replica` in fall mode.** Gateway-side policy simulation whose cumulative-cap check reads a pre-spend counter per request (A1 fall mode) and whose forwarder trusts method args (A4 fall mode), per the pass/fail lines of docs/ATTACK-BATTERY.md §A1-cap-race and §A4-key-scope-escape. — Done: with `ARENA_TARGET=gateway`, the A1 run settles 160 and the A4 run settles 50 to `attacker`.
5. **Build `contracts/reference-wallet` first pass.** Check-and-decrement that serializes concurrent spends so the settled sum == min(requested, remaining cap) (W-1, PRD.md §6); a policy forward validating receiver + amount per intent class so out-of-envelope FC-key calls fail (W-4, PRD.md §6); reference state transitions recomputable from on-chain state alone from day one (W-5 direction, docs/THREAT-MODEL.md §Trust boundaries). — Done: with `ARENA_TARGET=reference`, the A1 run settles exactly 100 and the A4 run settles 0.
6. **Implement the attack modules.** A1: velocity cap 100, 8 concurrent spends of 20 (total 160); A4: per-intent max 10, receiver allowlist `{recipient}`, crafted call of 50 to `attacker` — setups per docs/ATTACK-BATTERY.md §A1-cap-race and §A4-key-scope-escape; those sections own the step lists and oracles. — Done: both modules run under both targets.
7. **Wire the oracle and verdicts.** `ft_balance_of` deltas read from on-chain state alone; verdict `hold`/`fall` per docs/ATTACK-BATTERY.md §Verdict semantics (`reference` requires `hold`, `gateway` requires `fall`); the harness asserts the full oracle pair per PRD.md §5. — Done: every run's verdict is asserted from on-chain state only, and the pair (gateway run, reference run) is checked per attack.
8. **Put FR-11 in the product path.** The harness computes `verdict_hash` per receipt (PRD.md §5 FR-11) and runs an equality check on two identical invocations of one attack at the same fork block height. — Done: the double-run equality check is green inside the battery run.
9. **Ship the runner.** `pnpm arena:run` executes the M1 battery one-command in a clean environment (FR-9; docs/ARCHITECTURE.md §Runner contract). — Done: fresh clone + `pnpm install` + `pnpm arena:run` succeeds with no secret-bearing environment variables set.

## Requirement mapping

| ID | M1 evidence | Anchor |
|----|-------------|--------|
| FR-1 | gateway settled total 160 > velocity cap 100 | PRD.md §5; docs/ROADMAP.md row M1 |
| FR-2 | reference settled total == 100 exactly (160 requested) | PRD.md §5 |
| FR-5 | gateway attacker delta 50 / reference attacker delta 0 | PRD.md §5 |
| FR-7 | one receipt per run, per schema | docs/ARCHITECTURE.md §Receipt schema |
| FR-9 | clean-environment one-command run, no secrets | docs/ARCHITECTURE.md §Runner contract |
| FR-11 | `verdict_hash` per receipt; double-run hashes equal | PRD.md §5 FR-11; docs/ROADMAP.md §M0 spike record |
| W-1 | settled sum == min(requested, remaining cap) under A1 | PRD.md §6 |
| W-4 | out-of-envelope FC-key call fails under A4 | PRD.md §6 |
| INV-1, INV-4 | first held by the reference under A1, A4 | docs/THREAT-MODEL.md §Invariants |

## Verification

Run from the repo root at M1 close:

1. `find receipts -type f -name '*.json' | sort` → exactly:
   - `receipts/a1-cap-race/gateway-<run_id>.json`
   - `receipts/a1-cap-race/reference-<run_id>.json`
   - `receipts/a4-key-scope-escape/gateway-<run_id>.json`
   - `receipts/a4-key-scope-escape/reference-<run_id>.json`

   (`<run_id>` varies per run.) Oracle values exact: A1 recipient delta 160 (gateway) / 100 (reference); A4 attacker delta 50 (gateway) / 0 (reference).
2. The FR-11 double-run equality check (work-breakdown step 8) reports equal hashes.
3. Fresh clone + `pnpm install` + `pnpm arena:run` exits 0 with no secret-bearing environment variables.

| Check | Expected |
|-------|----------|
| receipts listing | the 4 paths above, nothing else |
| oracle values | FR-1: 160 > 100; FR-2: 100 == 100; FR-5: 50 vs 0 |
| double-run hashes | equal |
| fresh-clone run | exit 0, no secrets |

## Pre-decided responses

None new at M1. The scope-cut order (docs/ROADMAP.md §Scope-cut order) never cuts A1 or A4 — they land at M1 by definition.

## Non-finality markers

This doc mints none. The near-workspaces version pin is resolved upstream: docs/ROADMAP.md §M0 spike record carries `unverified — confirm at implementation` on the pin field until M0 closes, with resolver: the M0 spike per that record — M1 work-breakdown step 2 copies the recorded value into `packages/harness/package.json`.
