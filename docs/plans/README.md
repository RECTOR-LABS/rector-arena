# Implementation plans — M0..M5

Execution specs for the six milestones of PRD.md §10, one doc per milestone, each written so a fresh agent session implements that milestone with zero design decisions. PRD.md §10 fixes the traceability.

| File | Milestone | Window (UTC) | Closes |
|------|-----------|--------------|--------|
| [M0-spike.md](M0-spike.md) | M0 — spike gate | 2026-11-01 | §8 fork assumption; prerequisite for FR-1..FR-11 |
| [M1-harness-gateway.md](M1-harness-gateway.md) | M1 — harness + gateway falls | 2026-11-02 → 2026-11-05 | FR-1, FR-2, FR-5, FR-7, FR-9, FR-11; W-1, W-4 |
| [M2-reference-holds.md](M2-reference-holds.md) | M2 — reference holds | 2026-11-05 → 2026-11-08 | FR-3, FR-4; W-2, W-3 |
| [M3-settlement-proof.md](M3-settlement-proof.md) | M3 — settlement proof on-chain | 2026-11-08 → 2026-11-11 | FR-6, FR-8; SC-1, SC-2, SC-3; W-5; W-6 (stretch attempt) |
| [M4-proof-public-flip.md](M4-proof-public-flip.md) | M4 — proof + public flip | 2026-11-11 → 2026-11-12 | FR-10; SC-4 |
| [M5-demo-submit.md](M5-demo-submit.md) | M5 — demo + submit | 2026-11-13 (buffer 2026-11-14) | SC-5, SC-6 |

docs/ROADMAP.md is the acceptance authority; on any conflict ROADMAP wins.

Compliance: every file here obeys PRD.md §0 (documentation contract) and AGENTS.md §Doc law. The hedge gate covers these files — the banned-vocabulary pattern defined in AGENTS.md §Doc law, grep case-insensitive over `PRD.md;docs`, returns zero matches with docs/plans/*.md included.
