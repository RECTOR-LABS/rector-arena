# ROADMAP

Milestones M0..M5 with acceptance gates. Every milestone preserves INV-1..INV-5 (`docs/THREAT-MODEL.md`). Traceability IDs are the immutable registries in `PRD.md` §0. All dates UTC.

Baseline note: this scaffold was committed 2026-10-31 — pre-window baseline per the NEAR HACKATHON rules Q-001 (`docs/HACKATHON-EVENT.md`); judged in-window development starts 2026-11-01.

| Milestone | Window (UTC) | Scope | Acceptance | Closes |
|-----------|--------------|-------|------------|--------|
| M0 — spike gate | 2026-11-01 | Sandbox fork boots with live state; one battery-owned NEP-141 transfer simulated; per-tx and startup measurements recorded in this doc | Per-tx simulation ≤ 5 s p95 AND node startup ≤ 120 s AND the FR-11 double-run probe result is recorded | §8 environment assumptions in `PRD.md` (fork decision); prerequisite for FR-1..FR-11 |
| M1 — harness + gateway falls | 2026-11-02 → 2026-11-05 | Harness skeleton + `gateway-replica` + A1 + A4 green on the replica; reference-hold demonstrated | A1 replica settles 160 (FR-1); A1 reference settles exactly 100 (FR-2); A4 replica settles outside envelope (FR-5); receipts written per schema (FR-7); clean-env run with no secrets (FR-9); reference holds A1 + A4 (W-1, W-4 first pass) | FR-1, FR-2, FR-5, FR-7, FR-9, FR-11; W-1, W-4 |
| M2 — reference holds | 2026-11-05 → 2026-11-08 | Reference contract survives A1, A2, A3, A4; A2 + A3 green on both targets | A2 replica settles post-freeze / reference settles 0 (FR-3); A3 replica double-settles / reference settles once-amount (FR-4); W-2, W-3 demonstrated; W-1, W-4 re-verified under the grown battery | FR-3, FR-4; W-2, W-3 |
| M3 — settlement proof on-chain | 2026-11-08 → 2026-11-11 | A5 green; `attest` contract deployed on NEAR testnet; on-chain receipts | A5 replica drains victim / reference blocks + emits verdict receipt (FR-6); attest tx posted per receipt and explorer-verifiable (FR-8, SC-3); full battery one-command clean env (SC-1); reference preserves INV-1..INV-5 under the full battery (SC-2); policy state recomputable from receipts (W-5); W-6 stretch probe attempted | FR-6, FR-8; SC-1, SC-2, SC-3; W-5 |
| M4 — proof + public flip | 2026-11-11 → 2026-11-12 | Web leaderboard; README machine-proof pass; repo flipped public | Every README claim links to a receipt or doc artifact (FR-10, SC-4); leaderboard renders receipts; repo public (rule: public by 2026-11-14T23:59:00Z — `docs/HACKATHON-EVENT.md`) | FR-10; SC-4 |
| M5 — demo + submit | 2026-11-13 | Demo video recorded; X-post draft delivered to RECTOR (human posts it); submission payload printed + confirmed; POST sent | 90-second video: gateway red flip → reference green → injection blocked (SC-5); POST returns 201 before 2026-11-14T23:59:00Z (SC-6); payload per `docs/HACKATHON-EVENT.md` §Payload contract | SC-5, SC-6 |

Buffer: 2026-11-14 is reserved for retry of any M5 step (one submission per repository — the payload requestId is reused on retry per `docs/HACKATHON-EVENT.md`).

## Scope-cut order (pre-decided)

If single-maintainer bandwidth forces cuts, the cut order is A5, then A3, then A2. A1 and A4 are never cut (they land at M1). After a cut, the affected FR/W/SC ids move to the decision log in `PRD.md` §11 with the date and reason — no silent shrink.

## M0 spike record

Filled at M0 close, before M1 starts (the M0 acceptance gate lives in the table above):

- Fork decision: `unverified — confirm at implementation` (resolver: M0 spike, recorded here)
- Per-tx simulation p95: `unverified — confirm at implementation` (resolver: M0 spike, recorded here)
- Node startup time: `unverified — confirm at implementation` (resolver: M0 spike, recorded here)
- near-workspaces version pin: `unverified — confirm at implementation` (resolver: M0 spike; pin lands in `packages/harness/package.json` at M1)
- FR-11 verdict-hash determinism: `unverified — confirm at implementation` (resolver: M0 spike, recorded here — two runs of one attack at the same fork block height must produce equal verdict hashes; this record pins the canonical core field set)
