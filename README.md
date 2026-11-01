# rector-arena

Damn Vulnerable Agent Wallets — an open arena that hunts agent-wallet policy engines on NEAR, and ships the wallet that survives. This positioning is fixed ([PRD.md](PRD.md) §9, risk 3); the novelty cell it claims is dup-checked against eleven named prior-art neighbors ([docs/NOVELTY-POSITIONING.md](docs/NOVELTY-POSITIONING.md) §Claim). Not an end-user wallet: the hardened `reference` contract is a hardening reference, not a consumer product ([PRD.md](PRD.md) §1, non-goals).

## What it is

An open-source exploit battery that red-teams agent-wallet policy engines on a mainnet-forked NEAR sandbox: five deterministic attacks (A1..A5) run against two targets — `gateway-replica` falls by design, `reference` must hold — every oracle is a recomputable balance delta read from on-chain state alone, every run writes a receipt, and attestation-enabled runs post the verdict hash to NEAR testnet ([PRD.md](PRD.md) §1; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §Attestation flow). The problem is documented by the guardrails themselves: agent-wallet custody docs publish best-effort semantics — cumulative caps that admit a concurrent burst, freezes that leave resting orders live, and an ambiguous settlement status whose safe handling depends on every client honoring a docs warning ([PRD.md](PRD.md) §2, quotes frozen in [docs/quotes/outlayer-agent-custody.md](docs/quotes/outlayer-agent-custody.md)).

## Results (committed evidence)

The committed receipts are the milestone evidence: 10 runs, one per (attack, target); each verdict hash below is attested on the live testnet ledger `attest-ledger.testnet` and recompute-verified ([docs/ROADMAP.md](docs/ROADMAP.md) `## M3 record`; verification procedure: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §Attestation flow).

| Attack | Weakness class | `gateway-replica` | `reference` |
|--------|----------------|-------------------|-------------|
| [A1-cap-race](receipts/a1-cap-race/gateway-20261101T171313Z.json) | Concurrent spends vs velocity cap (100) | [falls — 160 settle across 8 concurrent txs](receipts/a1-cap-race/gateway-20261101T171313Z.json) | [holds — exactly the cap, 100 settle](receipts/a1-cap-race/reference-20261101T171651Z.json) |
| [A2-freeze-bypass](receipts/a2-freeze-bypass/gateway-20261101T171420Z.json) | Resting commitment settles after freeze | [falls — 25 settle post-freeze](receipts/a2-freeze-bypass/gateway-20261101T171420Z.json) | [holds — 0 settle post-freeze](receipts/a2-freeze-bypass/reference-20261101T171811Z.json) |
| [A3-needs-review-double-spend](receipts/a3-needs-review-double-spend/gateway-20261101T171453Z.json) | Ambiguous status + client retry | [falls — 60 settle, one intent paid twice](receipts/a3-needs-review-double-spend/gateway-20261101T171453Z.json) | [holds — once-amount only, 30 settle](receipts/a3-needs-review-double-spend/reference-20261101T171853Z.json) |
| [A4-key-scope-escape](receipts/a4-key-scope-escape/gateway-20261101T171527Z.json) | Function-call key chains value movement outside intent | [falls — 50 settle outside the policy envelope](receipts/a4-key-scope-escape/gateway-20261101T171527Z.json) | [holds — 0 settle outside the envelope](receipts/a4-key-scope-escape/reference-20261101T171928Z.json) |
| [A5-injection-to-payment](receipts/a5-injection-to-payment/gateway-20261101T171605Z.json) | Poisoned content drives a drain | [falls — victim drained of the full 200](receipts/a5-injection-to-payment/gateway-20261101T171605Z.json) | [holds — 0; provenance blocks the drain](receipts/a5-injection-to-payment/reference-20261101T172012Z.json) |

Amounts are whole battery-FT tokens (24 decimals; receipt deltas are base-unit strings per [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §Receipt schema). Verdict semantics and per-attack oracles: [docs/ATTACK-BATTERY.md](docs/ATTACK-BATTERY.md).

## Try it

Each step is a command and its observable result — screening runs machine reproducibility checks over exactly this ([docs/HACKATHON-EVENT.md](docs/HACKATHON-EVENT.md), rule Q-017).

1. Build the harness, the target simulation, and both contracts — reference wasm 186 KB, attest wasm 204,612 bytes at M3 close, per the M1 and M3 records in [docs/ROADMAP.md](docs/ROADMAP.md):

   ```
   pnpm install && pnpm -r build
   ```

2. Run the full battery — both targets in one command, clean environment, no secrets: 10 receipts under `receipts/`, oracle pairs evaluated, `full_battery_gate=PASS` expected (FR-9, SC-1); runner contract in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §Runner contract, per-attack setup and oracles in [docs/ATTACK-BATTERY.md](docs/ATTACK-BATTERY.md), M3 record in [docs/ROADMAP.md](docs/ROADMAP.md):

   ```
   pnpm arena:run
   ```

3. View the leaderboard — every committed receipt with its recomputed verdict hash and live attestation state from the testnet ledger, per [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §Package tree:

   ```
   pnpm arena:web
   ```

4. Prove this page — every claim line artifact-linked, every receipt under `receipts/` linked, the novelty block verbatim against [docs/NOVELTY-POSITIONING.md](docs/NOVELTY-POSITIONING.md) §Claim (FR-10, SC-4); checker contract in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §Runner contract:

   ```
   pnpm arena:prove
   ```

5. Verify an attestation without this repo's tooling: recompute SHA-256 over a receipt's canonical core (`attack_id`, `target`, `verdict`, `per_account_deltas`, in that order) and compare it with a `get_attestation` view call against `attest-ledger.testnet` — procedure in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §Attestation flow; the ledger on the explorer: [attest-ledger.testnet](https://explorer.testnet.near.org/accounts/attest-ledger.testnet).

## Novelty claim

> Existing public work probes payment protocols over HTTP, statically fixtures agent tooling (including injection→wallet-exfiltration against synthetic wallets), or red-teams agents in simulated ledgers behind closed arenas — none publicly executes a financial exploit against the agent-wallet policy engine itself (spend caps, freezes, settlement receipts, function-call-key scoping) on a real NEAR fork, with settlement.

Audit trail: [docs/NOVELTY-POSITIONING.md](docs/NOVELTY-POSITIONING.md) — §Claim plus eleven pinned prior-art neighbors, URLs re-verified 2026-10-31. Per FR-10 ([PRD.md](PRD.md) §5), every claim on this page links to its artifact.

## Documentation

- [PRD.md](PRD.md) — master product requirements: §0 documentation contract, invariants INV-1..INV-5, FR/W/SC registries, decision log.
- [docs/ATTACK-BATTERY.md](docs/ATTACK-BATTERY.md) — per-attack specs A1..A5: setup, steps, oracle, pass/fail, evidence.
- [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) — assets, adversaries, trust boundaries, invariants.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — monorepo layout, runtime flow, receipt JSON schema, attestation flow, runner contract.
- [docs/ROADMAP.md](docs/ROADMAP.md) — M0..M5 milestones with acceptance gates and the M0..M3 execution records.
- [docs/NOVELTY-POSITIONING.md](docs/NOVELTY-POSITIONING.md) — prior-art neighbors table + the novelty claim, dup-checked.
- [docs/HACKATHON-EVENT.md](docs/HACKATHON-EVENT.md) — NEAR HACKATHON rules (verbatim copy) + submission checklist + payload contract.
- [docs/quotes/outlayer-agent-custody.md](docs/quotes/outlayer-agent-custody.md) — frozen snapshot of the partner-doc anchors quoted in [PRD.md](PRD.md) §2.
- [AGENTS.md](AGENTS.md) — working conventions for agent sessions on this repo.

License: MIT ([LICENSE](LICENSE)); the documentation contract in [PRD.md](PRD.md) §0 binds every doc in this repository.
