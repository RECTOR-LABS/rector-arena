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

## M3 record

Created by docs/plans/M3-settlement-proof.md (work-breakdown steps 4 and 9). All values measured 2026-11-01.

**Attest contract on NEAR testnet (FR-8, SC-3).**

- Contract account: `attest-ledger.testnet` — the final, faucet-funded home of the ledger. The canonical-core amendment (below) changed every receipt's verdict hash, and the contract is append-once per (attack_id, target): a different hash for a recorded cell aborts (conflict path unit-tested offline in contracts/attest; no on-chain refusal was exercised), so the pre-amendment ledger on `attest-2.arena-attest.testnet` was NOT re-pointed at the amended receipts — a fresh account was deployed preventively. `arena-attest.testnet` (which carries the M3 smoke attestation) and `attest.arena-attest.testnet` are earlier generations of the same deploy sequence.
- Funding: the helper faucet transferred 10 NEAR to `attest-ledger.testnet` (tx `D5RNoPruyAuc4oHjBfWfZv6BAbB4DFJ4ZHmpFJoqCKXB`, PRD.md §8 faucet row / docs/HACKATHON-EVENT.md Q-008). Required balance: 10 NEAR funded — the contract locks a storage stake of ~2.05 NEAR at the standard 10^19 yocto/byte pricing (storage_usage 204,873 bytes post-deploy), leaving ~7.94 NEAR free for gas; measured per-attest cost 0.00039381 NEAR covers ≥20,000 further attests. Deploy + `new()` batch tx `DNkHz3oMhpTRGZZFjcJNKNUNuUsRKkwYn7XKjk7jCPKV`; post-deploy balance 9.998338 NEAR. Operational note: a contract-holding account whose free balance (balance − storage stake) is below the amount it tries to send is rejected with `LackBalanceForState` — fund contract accounts well above their stake.
- Authoritative attested run (`ARENA_ATTEST=1 pnpm arena:run`, full battery under the amended canonical core, exit 0): 10 attest txs, one per receipt — `H7GB1QeMz4YC1b2RaDVTf7FpJhgrz7j8ucbnx9czTJrJ`, `GHBcpoMYD8jouaJV6quqtUMZy58p6rWY3gKagFv3NSgD`, `891CSgdQcYRa68YNjGxn6Uyu4vMHpYkeK8pMmtDvPvss`, `HLdh8JSEQREsVNUqsKv7yvc5akoKMonJS3t7JWKeVgPx`, `BtqCsAeWMsuNEKJoY23LXCDhEfw5zBqRSzKaLke7nNFL` (gateway A1..A5), `EMmxJLFqWwgHpMsFf95jyqevd4sDYMsTbtS6tDK8927o`, `5JxBrsRoYrBCVSwM72CSuwCuJsabJU8ixrbNkFijX5yW`, `GfMvnHJUKektLCR8iuqRnehmQAEQ9pUACWGqBFkQM2UE`, `CBbmGFoVYjK3KUEMNC74pHFDeTWGnx8wUsFu7svgsm8q`, `8SoBHbsYws95NhdT8sPh9C1LAcjSJbffbXALf8ULWCSg` (reference A1..A5). All resolve at explorer.testnet.near.org; per-attest cost measured 0.00039381 NEAR. Post-run balance: 9.99606123 NEAR.
- Verifiability procedure result (docs/ARCHITECTURE.md §Attestation flow): recomputed sha256 (amended core) from each of the 10 receipt files equals the file's `verdict_hash` AND the contract's recorded hash (`get_attestation` view) — 10/10 OK; `attestation_count` == 10.

**W-6 stretch probe outcome (docs/ATTACK-BATTERY.md §Stretch probe).**

- NEP registry resolution (the `unverified — confirm at implementation` resolver): NEP-611 EXISTS and is Gas Keys — docs.near.org `protocol/accounts-contracts/gas-keys`: access keys with a prepaid gas balance and up to 1,024 independent nonce lanes, introduced in nearcore 2.13 at protocol version 86 (the fastnear gas-keys guide pins the protocol floor at 85). The PRD decision log's NEP id is CORRECT.
- Probe execution (`packages/harness/src/spike/w6.ts`, standalone; the battery's pinned sandbox near-sandbox 0.1.5 / neard 2.6.2 predates gas keys, so the probe boots its own near-sandbox 0.3.4 / neard 2.13.4, reported protocol_version 86, and never touches the battery pins): sibling-lane setup (one gas key, `num_nonces: 2`), exhaustion trigger (6 sequential lane-0 transfers, then 1 more lane-0 tx left in flight), sibling observation — the lane-1 tx landed in 648 ms while the lane-0 tx was in flight; `view_gas_key_nonces` deltas +7 (lane 0) and +1 (lane 1) from the pre-burst baseline (nonces start at block_height × 1e6 per NEP-611); gas isolation observed — the wallet's main balance was unchanged across all 8 txs while the key's prepaid balance paid 0.00003570921 NEAR of gas.
- Outcome: mechanism confirmed + sibling isolation observed. W-6 is NOT retired; it remains a stretch wallet capability — the reference wallet does not issue gas keys, and the battery's pinned runtime cannot host them (see above), so no SC consumes W-6 at M3.

**Runner/amendment note (SC-1).** The Targets registry (docs/ATTACK-BATTERY.md) is amended as of M3: unset or empty `ARENA_TARGET` runs the full battery across BOTH targets in one command; a set value keeps the M1 single-target semantics; any other value aborts with a usage error before account creation. The authoritative run produced 10 receipts and `full_battery_gate=PASS` (gateway: A1 160 / A2 25 / A3 60 / A4 50 / A5 200 all fall; reference: A1 100 / A2 0 / A3 30 / A4 0 / A5 0 all hold; FR-11 equal on both targets; W-5 ok; SC-2 ok).

**Canonical-core amendment (2026-11-02, recorded per the FR-11 procedure above).** `block_heights` is REMOVED from the canonical core: two same-height gateway A1 runs produced unequal verdict hashes because sandbox block scheduling split the 8 concurrent settle txs across blocks differently between in-process runs (observed once in a fresh-clone run after fb9d981; the gateway's fall shape itself — all 8 spends reading the same pre-spend counter — stays structurally deterministic, as do the reference deltas). The core is now `attack_id`, `target`, `verdict`, `per_account_deltas` (docs/ARCHITECTURE.md §Receipt schema). Consequence handled at M3: all 10 authoritative receipts were regenerated under the amended core and re-attested on a fresh contract account (`attest-3.arena-attest.testnet`), because the attest contract's tamper lock correctly refuses a different hash for an attested cell.

## M4 record

Created by docs/plans/M4-proof-public-flip.md. All values measured 2026-11-02.

**Machine-proof (FR-10, SC-4).**

- `pnpm arena:prove` (packages/harness/src/prove.ts) enforces four checks over README.md: (1) every claim line — any line that is not a heading, fenced block, image, blank line, table header/separator row, or the Novelty-claim blockquote — carries at least one artifact link (an existing in-repo file under `receipts/` or `docs/`, or the root PRD.md / AGENTS.md / LICENSE); (2) every receipt JSON under `receipts/` is linked by at least one claim; (3) the README "## Novelty claim" blockquote equals the docs/NOVELTY-POSITIONING.md §Claim blockquote verbatim; (4) any repo-relative link that does not resolve to an existing file fails outright. Measured: PASS — 26 claims, all artifact-linked; 10/10 receipts covered; novelty verbatim. Negative-tested the same day: unlinked claim, novelty drift, unlinked receipt, and dangling link each exit 1 with a line-numbered message.
- README.md rewritten to the machine-reader shape (docs/HACKATHON-EVENT.md rule Q-017: what it is, the problem, do-X-see-Y try-steps; no marketing): results table linking all 10 receipts with the measured oracle pairs, attestation-verification walk-through, verbatim novelty claim, documentation map. The banned-hedge gate over README.md + PRD.md + docs/ measures zero hits at M4 close.

**Leaderboard (docs/ARCHITECTURE.md §Package tree).**

- packages/web (Next.js 16.4.3, React 19.3.1, Tailwind 4.3.3, TypeScript strict) renders one row per attack with a verdict cell per target: verdict, humanized settled total, receipt link, ran_at, recomputed-canonical-core integrity state, and live attestation state. `pnpm arena:web` serves it.
- Observed 2026-11-02: all 10 committed receipts rendered, 10/10 attestation cells match on-chain (`get_attestation` on `attest-ledger.testnet` via rpc.testnet.fastnear.com, fallback rpc.testnet.near.org), `attestation_count` 10; RPC-unreachable renders the graceful per-cell state without crashing. `next build` performs no fs/RPC work (route `/` is server-rendered on demand).

**Quote re-check (docs/plans/M4-proof-public-flip.md step 4).**

- The three PRD.md §2 anchors are character-identical (modulo the documented emphasis-strip and ` …` truncation transforms) to BOTH the frozen snapshot (docs/quotes/outlayer-agent-custody.md) and the live page (app.outlayer.ai/docs/agent-custody, re-fetched 2026-11-02). The live page gained an unrelated "Transfer inside Intents" section and re-nested headings since the 2026-10-31 fetch; the three quoted sections are unchanged. The fourth §2 quote (hackathon build theme) matches the verbatim copy in docs/HACKATHON-EVENT.md.
- One transcription deviation found and fixed in the same pass: PRD.md §2 quote 2 opened with capital "Freezing" where the source reads lowercase "freezing" — lowercased (RECTOR-approved at the M4 gate).

**Public flip (docs/HACKATHON-EVENT.md Submission checklist item 1).**

- RECTOR-LABS/rector-arena flipped public on 2026-11-02 (RECTOR-approved at execution; spec window 2026-11-11 → 2026-11-12, hard deadline 2026-11-14T23:59:00Z — 12 days of margin). Logged-out reachability verified: https://github.com/RECTOR-LABS/rector-arena returns 200 unauthenticated. No secrets are tracked (FR-9: the per-repo `.env` is gitignored; the repository carries only sandbox/testnet public data).

**Full-battery re-run at M4 close (clean `receipts/`, `ARENA_ATTEST` unset).** Exit 0, `receipts=10`, `full_battery_gate=PASS`; gateway A1 160 / A2 25 / A3 60 / A4 50 / A5 200 all fall; reference A1 100 / A2 0 / A3 30 / A4 0 / A5 0 all hold; FR-11 equal on both targets at fork height 222603395; W-5 ok; SC-2 ok; `pnpm -r build` exit 0 across all six workspace projects. The committed receipt evidence is unchanged — restored after the re-run.
