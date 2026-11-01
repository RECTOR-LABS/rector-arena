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

- Fork decision: mainnet-RPC fork via near-workspaces `importContract` (`wrap.near` wasm at block 222518565, `withData: false` — public-RPC live-state import is capped at 50 kB, battery state is battery-owned per PRD.md §8); fork-data endpoint `https://rpc.mainnet.fastnear.com` — `rpc.mainnet.near.org` is deprecated and answers heavy queries with 429 + a stop-using notice, so `packages/harness/src/spike/m0.ts` pins near-workspaces' `NEAR_CLI_MAINNET_RPC_SERVER_URL` hook; testnet fallback not exercised.
- Per-tx simulation p95: 2021 ms (nearest-rank over 20 settle transactions on the forked worker; single e2e NEP-141 transfer verified `ft_balance_of(recipient)` == 1e24). Gate input PASS.
- Node startup time: 528 ms (worst of 3 cold boots; samples 517, 528, 516 ms; sandbox binary download excluded via one un-timed warm-up boot at 554 ms). Gate input PASS.
- near-workspaces version pin: 5.0.0 (resolved by M0; pin lands in `packages/harness/package.json` at M1).
- FR-11 verdict-hash determinism: equal — two A1-cap-race-shape runs at one fork block height produced identical verdict hashes (sha256 `076eb0c74e5df576d8abbb5cd199f90f6f2be75ae43f6ccbc969fb4172997bd0`, reproduced unchanged across sessions); canonical core field set pinned: `attack_id`, `target`, `verdict`, `per_account_deltas`, `block_heights`; `ran_at` and `tx_hashes` excluded per docs/ARCHITECTURE.md §Receipt schema; no field drop required. Probe shape note: near-workspaces coalesced the 8 concurrent `callRaw` submissions into one transaction per run (settled 20 tokens, verdict hold — hash determinism unaffected), so A1 at M1 signs its parallel spends with distinct access keys to exercise the race. M0 operational finding: wasm emitted by rustc ≥ 1.86 or near-sdk ≥ 5.x fails the sandbox prepare step (near-sandbox 0.1.5, neard 2.6.2) — the vendored FT is near-sdk-rs 4.1.1 built per `packages/harness/vendor/PROVENANCE.md`.
