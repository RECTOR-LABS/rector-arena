# rector-arena

Damn Vulnerable Agent Wallets — an open arena that hunts agent-wallet policy engines on NEAR, and ships the wallet that survives.

![status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange)

## Status

Docs-first scaffold — implementation starts at M0 (`docs/ROADMAP.md`). Nothing installs yet by design.

## What it is

An open-source exploit battery that red-teams agent-wallet policy engines on a NEAR sandbox fork. Five deterministic attacks run against two targets: `gateway-replica` falls by design, `reference` must hold. Every attack's oracle is a recomputable balance delta; every run writes a receipt; attestation-enabled runs post the verdict hash to NEAR testnet. The hardened reference wallet survives the full battery — the attack and the survivor ship in one repo.

## Attack battery

| Attack | Weakness class | `gateway-replica` | `reference` |
|--------|----------------|-------------------|-------------|
| A1-cap-race | Concurrent spends vs velocity cap | falls — over-cap settlement lands | holds — exactly the cap settles |
| A2-freeze-bypass | Resting commitment settles after freeze | falls — post-freeze settlement > 0 | holds — post-freeze settlement == 0 |
| A3-needs-review-double-spend | Ambiguous status + client retry | falls — intent settles twice | holds — settles the once-amount |
| A4-key-scope-escape | Function-call key chains value movement outside intent | falls — settlement outside the policy envelope | holds — no settlement outside the envelope |
| A5-injection-to-payment | Poisoned content drives a drain | falls — victim balance drained | holds — balance unchanged + verdict receipt |

Full specs: `docs/ATTACK-BATTERY.md`. Invariants INV-1..INV-5: `docs/THREAT-MODEL.md`.

## Novelty claim

> Existing public work probes payment protocols over HTTP, statically fixtures agent tooling (including injection→wallet-exfiltration against synthetic wallets), or red-teams agents in simulated ledgers behind closed arenas — none publicly executes a financial exploit against the agent-wallet policy engine itself (spend caps, freezes, settlement receipts, function-call-key scoping) on a real NEAR fork, with settlement.

Audit trail: `docs/NOVELTY-POSITIONING.md` (§Claim + eleven pinned prior-art neighbors). Per FR-10 (`PRD.md` §5), every claim on this page links to its artifact.

## Repo map

| Path | Contents |
|------|----------|
| `PRD.md` | Master product requirements — §0 doc contract, invariants, FR/W/SC registries, decision log |
| `docs/ATTACK-BATTERY.md` | Per-attack specs A1..A5 — setup, steps, oracle, pass/fail, evidence |
| `docs/THREAT-MODEL.md` | Assets, adversaries, trust boundaries, invariants |
| `docs/ARCHITECTURE.md` | Monorepo layout, runtime flow, receipt JSON schema, attestation flow |
| `docs/ROADMAP.md` | M0..M5 milestones with acceptance gates and traceability |
| `docs/NOVELTY-POSITIONING.md` | Prior-art neighbors table + the novelty claim, dup-checked |
| `docs/HACKATHON-EVENT.md` | NEAR HACKATHON rules (verbatim copy) + submission checklist + payload contract |
| `AGENTS.md` | Working conventions for agent sessions on this repo |

License: MIT (`LICENSE`).
