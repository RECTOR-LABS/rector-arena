# M0 — spike gate

| Field | Value |
|-------|-------|
| Milestone | M0 — spike gate |
| Window (UTC) | 2026-11-01 |
| Closes | §8 fork assumption; prerequisite for FR-1..FR-11 |
| Acceptance authority | docs/ROADMAP.md row M0 |

Execution spec for M0. Subordinate to docs/ROADMAP.md row M0; on any conflict ROADMAP wins. Citations follow PRD.md §0(f): IDs and §anchors, never restated canonical content.

## Objective

Boot the sandbox fork with live state, simulate battery-owned NEP-141 transfers on it, record the measurements, and decide the fork — before M1 starts. M0 closes no FR/W/SC id: it resolves the fork assumption (PRD.md §8) and pins the FR-11 canonical core that every later receipt's verdict_hash depends on.

## Prerequisites

None — first milestone in docs/ROADMAP.md. Read the doc set in the AGENTS.md order: PRD.md, then docs/ROADMAP.md, docs/ATTACK-BATTERY.md, docs/ARCHITECTURE.md. Execution starts inside the hackathon window (2026-11-01T00:00:00Z or later; pre-window commits are baseline per docs/HACKATHON-EVENT.md Q-001).

## Work breakdown

Steps run in order. Each names its action and its done-condition.

1. **Bootstrap the harness package.** Create `packages/harness/` (package.json, TypeScript strict tsconfig, 2-space indent), the repo-root `pnpm-workspace.yaml` covering `packages/*`, `targets/*`, `contracts/*` (docs/ARCHITECTURE.md §Package tree), and `packages/harness/src/spike/m0.ts` as the spike entry point, run via tsx. — Done: `pnpm install` completes and `pnpm tsx packages/harness/src/spike/m0.ts` exits 0.
2. **Install near-workspaces and boot the fork.** Add near-workspaces to `packages/harness`; capture the exact installed version string. Boot the sandbox fork with live state (fork network decided by this milestone's step 7, not before). — Done: the node reaches ready in the spike run; the version string is captured for docs/ROADMAP.md §M0 spike record (`near-workspaces version pin`).
3. **Deploy the battery FT and measure per-tx simulation.** Deploy a battery-owned NEP-141 token (24 decimals, docs/ATTACK-BATTERY.md §Shared environment); simulate the single battery-owned NEP-141 transfer of the docs/ROADMAP.md row M0 scope end-to-end; then execute 20 settle transactions and compute the per-tx simulation p95 over those 20. — Done: `m0.ts` prints the p95 over the 20 runs.
4. **Measure node startup.** Boot the node 3× cold. — Done: `m0.ts` prints the worst-case startup time of the 3 boots.
5. **Run the FR-11 double-run probe.** Run A1-cap-race twice at one fork block height (PRD.md §5 FR-11; the attack modules arrive at M1, so `m0.ts` implements the A1-cap-race shape inline). Compute SHA-256 over each run's canonical core — every field of docs/ARCHITECTURE.md §Receipt schema except `ran_at` and `tx_hashes`. Record equal/unequal plus the core field set as run; a field that breaks equality is dropped from the core with the drop recorded. — Done: probe result (equal/unequal) and the pinned core field set are in hand.
6. **Write nothing under `receipts/`.** That directory is FR-7 output starting at M1. All M0 results land only in docs/ROADMAP.md §M0 spike record. — Done: `git status --short` lists no `receipts/` path at M0 close.
7. **Fill the spike record.** Fill all five fields of docs/ROADMAP.md §M0 spike record: fork decision (mainnet-RPC fork vs testnet fork, docs/ARCHITECTURE.md §Sandbox fork), per-tx simulation p95, node startup time, near-workspaces version pin, FR-11 verdict-hash determinism (equal/unequal plus the pinned core field set and any drop). — Done: the record contains zero `unverified` lines when M0 closes.
8. **Evaluate the gate.** PASS requires per-tx sim ≤ 5 s p95 AND node startup ≤ 120 s AND the FR-11 probe result recorded (docs/ROADMAP.md row M0 acceptance). On FAIL, write the pivot into docs/ROADMAP.md §M0 spike record before M1 starts. — Done: the record states PASS, or the recorded pivot.

## Requirement mapping

| Item | M0 obligation | Anchor |
|------|---------------|--------|
| Fork assumption | Decided with measured numbers recorded in the spike record | PRD.md §8; docs/ARCHITECTURE.md §Sandbox fork; docs/ROADMAP.md row M0 |
| FR-11 | Double-run probe executed; canonical core field set pinned | PRD.md §5 FR-11; docs/ROADMAP.md §M0 spike record |
| FR-1..FR-11 | Prerequisite milestone — closes no requirement, unblocks M1 | docs/ROADMAP.md row M0 |

## Verification

Run from the repo root at M0 close:

1. `pnpm tsx packages/harness/src/spike/m0.ts` re-run prints the recorded p95, startup, and probe values.
2. `sed -n '/^## M0 spike record/,$p' docs/ROADMAP.md | grep -c "unverified"` → `0`.
3. `git status --short` lists no `receipts/` path.

| Check | Expected |
|-------|----------|
| `m0.ts` re-run | recorded p95 ≤ 5 s, startup ≤ 120 s, probe result printed |
| spike-record grep | `0` |
| `git status --short` | no `receipts/` path |

## Pre-decided responses

Gate FAIL → pivot per PRD.md §9 risk 1, cited verbatim: "Pivot documented in docs/ROADMAP.md before M1: testnet fork, or mocked-state runner. The pivot choice is recorded with the M0 measurements."

## Non-finality markers

This doc mints none. The five fields of docs/ROADMAP.md §M0 spike record each currently carry `unverified — confirm at implementation` (fork decision, per-tx simulation p95, node startup time, near-workspaces version pin, FR-11 verdict-hash determinism) with resolver: the M0 spike itself, recorded in that section — work-breakdown step 7 replaces all five marker lines with recorded values.
