# M3 — settlement proof on-chain

| Field | Value |
|-------|-------|
| Milestone | M3 — settlement proof on-chain |
| Window (UTC) | 2026-11-08 → 2026-11-11 |
| Closes | FR-6, FR-8; SC-1, SC-2, SC-3; W-5; W-6 (stretch attempt) |
| Acceptance authority | docs/ROADMAP.md row M3 |

Execution spec for M3. Subordinate to docs/ROADMAP.md row M3; on any conflict ROADMAP wins. Citations follow PRD.md §0(f): IDs and §anchors, never restated canonical content.

## Objective

A5 runs; verdicts are attested on NEAR testnet and explorer-verifiable; the full battery (A1..A5 × both targets) runs one-command in a clean environment.

## Prerequisites

M2 green: survival set A1..A4 on the reference (docs/plans/M2-reference-holds.md Verification). A funded testnet account for the `attest` contract, funded via the faucet (docs/HACKATHON-EVENT.md Q-008).

## Work breakdown

Steps run in order. Each names its action and its done-condition.

1. **Implement attack module A5.** Per docs/ATTACK-BATTERY.md §A5-injection-to-payment (that section owns the step list): victim wallet with full balance; poisoned-content fixture (an email body instructing transfer of the entire balance to `attacker`); the agent flow produces the transfer request. Oracle = victim balance delta + presence of a block-verdict receipt — the block-verdict receipt is the run's single receipt per docs/ARCHITECTURE.md §Receipt schema, carrying `verdict` = `hold` on the reference run; no second schema exists. — Done: A5 runs under both targets and asserts its oracle from on-chain state.
2. **Implement request-flow provenance in `contracts/reference-wallet`.** Reject intents that did not originate from the approved request flow (INV-5, docs/THREAT-MODEL.md §Invariants). — Done: A5 with `ARENA_TARGET=reference` reads victim delta 0 with the block-verdict receipt present.
3. **Implement `contracts/attest`.** Rust near-sdk contract (docs/ARCHITECTURE.md §Package tree): `attest(attack_id: String, target: String, verdict_hash: String)` plus a view returning recorded hashes; unit-tested offline first. — Done: `cargo test` green with no network.
4. **Deploy `contracts/attest` on NEAR testnet.** Fund via the faucet (docs/HACKATHON-EVENT.md Q-008; PRD.md §8 faucet row); record the required balance and the funding tx in a new `## M3 record` section of docs/ROADMAP.md, created by this milestone. — Done: the `## M3 record` section carries the balance and the funding tx.
5. **Wire the attestation flow.** With `ARENA_ATTEST=1`, post one attest tx per receipt (docs/ARCHITECTURE.md §Attestation flow); retries 3 attempts with 2 s backoff, same `verdict_hash` (PRD.md §8 RPC row); verify at explorer.testnet.near.org. — Done: every receipt's attest tx resolves on the explorer carrying the receipt's verdict hash.
6. **Complete the runner for the full battery (SC-1).** `pnpm arena:run` executes the full battery (A1..A5 × both targets) one-command in a clean environment with no secrets (docs/ARCHITECTURE.md §Runner contract; PRD.md §7 SC-1). — Done: fresh clone + `pnpm install` + `pnpm arena:run` exits 0 and produces 10 receipts.
7. **Assert W-5 across the battery.** The harness recomputes the policy state transition from on-chain state + receipts and asserts equality (PRD.md §6 W-5). — Done: the recomputation assertion is green across all 10 runs.
8. **Assert SC-2 across the battery.** The reference preserves INV-1..INV-5 under the full battery (PRD.md §7 SC-2; docs/THREAT-MODEL.md §Invariants). — Done: the harness assertion is green.
9. **Run the W-6 stretch probe.** Per docs/ATTACK-BATTERY.md §Stretch probe: check the NEP registry at docs.near.org for the NEP-611 gas-key mechanism, then execute the probe design this milestone owns — sibling-lane setup, exhaustion trigger, sibling observation; the probe's concrete steps are implementation work, not doc content. Record the outcome in docs/ROADMAP.md `## M3 record`. An absent NEP is recorded as the outcome, and W-6 retirement is logged in PRD.md §11 with date and reason (PRD.md §0(a)). — Done: the `## M3 record` states the probe outcome (mechanism confirmed + sibling isolation observed, or NEP absent + retirement logged).

## Requirement mapping

| ID | M3 evidence | Anchor |
|----|-------------|--------|
| FR-6 | gateway drains the victim / reference victim delta 0 + block-verdict receipt | PRD.md §5; docs/ROADMAP.md row M3 |
| FR-8 | attest tx per receipt resolves on the explorer carrying `verdict_hash` | PRD.md §5; docs/ARCHITECTURE.md §Attestation flow |
| SC-1 | full battery one-command, clean environment, no secrets | PRD.md §7; docs/ARCHITECTURE.md §Runner contract |
| SC-2 | reference preserves INV-1..INV-5 under the full battery | PRD.md §7 |
| SC-3 | receipts attested on testnet, explorer-verifiable | PRD.md §7 |
| W-5 | policy state transition recomputable from on-chain state + receipts | PRD.md §6 |
| W-6 | stretch attempt per the probe design | docs/ATTACK-BATTERY.md §Stretch probe |

## Verification

Run from the repo root at M3 close:

1. `find receipts -type f -name '*.json' | wc -l` → `10` (A1..A5 × gateway/reference; `<run_id>` varies per run).
2. Each receipt's attest tx resolves on explorer.testnet.near.org with the recomputed `verdict_hash` (docs/ARCHITECTURE.md §Attestation flow verifiability procedure).
3. Fresh clone + `pnpm install` + `pnpm arena:run` exits 0 with no secret-bearing environment variables.
4. docs/ROADMAP.md `## M3 record` carries the required testnet balance and the funding tx.

| Check | Expected |
|-------|----------|
| receipt count | 10 |
| attest txs | all resolve on the explorer |
| fresh-clone run | exit 0, 10 receipts |
| M3 record | balance + funding tx present |

## Pre-decided responses

The scope-cut order (docs/ROADMAP.md §Scope-cut order) cuts A5 first under bandwidth pressure. Any cut is logged in PRD.md §11 with date and reason — no silent shrink.

## Non-finality markers

This doc mints none; it cites two existing ones:

- W-6: docs/ATTACK-BATTERY.md §Stretch probe carries `unverified — confirm at implementation` on the NEP id and its runtime API shape, with resolver: the NEP registry at docs.near.org plus the M3 probe outcome, recorded in docs/ROADMAP.md `## M3 record` (work-breakdown step 9).
- FR-11 determinism: resolved upstream at M0 — PRD.md §5 FR-11 carries `unverified — confirm at implementation` with resolver: docs/ROADMAP.md §M0 spike record; M3 cites that record read-only and changes nothing in it.
