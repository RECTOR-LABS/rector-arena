# DETERMINISM

Committed determinism manifest for the arena battery: the full-battery verification runs (one authoritative run plus four reproductions), the FR-11 verdict-hash table over the committed receipts, and the reproduction procedure. Conformance vocabulary: `docs/specs/CONFORMANCE.md`; execution record: `docs/ROADMAP.md` `## M4 record`.

## Verification runs

| Run | Date | Environment | Result |
|-----|------|-------------|--------|
| 1 — authoritative | 2026-11-01 | full battery, both targets, one command (`SC-1`); receipts committed at `receipts/` | 10 receipts, `full_battery_gate=PASS`, FR-11 equal on both targets (`docs/ROADMAP.md` `## M3 record`) |
| 2 — M4-close re-run | 2026-11-02 | clean `receipts/`, `ARENA_ATTEST` unset, fork height 222603395 | exit 0, `receipts=10`, `full_battery_gate=PASS`, FR-11 equal; committed evidence unchanged (restored after the re-run; `docs/ROADMAP.md` `## M4 record`) |
| 3 — fresh clone | 2026-11-05 | fresh clone, same runner contract (`docs/ARCHITECTURE.md` §Runner contract) | all 10 verdict hashes reproduced ([README.md](../README.md) §Results; `docs/ROADMAP.md` `## M4 record`) |
| 4 — fresh clone A | 2026-11-08 | fresh clone, same runner contract | all 10 verdict hashes reproduced byte-identically ([README.md](../README.md) §Results) |
| 5 — fresh clone B | 2026-11-09 | fresh clone, same runner contract | all 10 verdict hashes reproduced byte-identically ([README.md](../README.md) §Results) |
| 6 — r2 verification round | 2026-11-09 | four independent reviewer fresh clones at pin `68a62eb`, same runner contract | each reproduced all 10 verdict hashes byte-identically (r2 verification round) |

FR-11 (double-run verdict-hash equality, `PRD.md` §5) is enforced inside every run by the probe in `runTarget` (`packages/harness/src/run.ts`); runs 1–5 each executed it per target. The canonical core hashed is `attack_id`, `target`, `verdict`, `per_account_deltas` in that order (`docs/ARCHITECTURE.md` §Receipt schema; `block_heights` exclusion recorded in `docs/ROADMAP.md` `## M4 record`).

## Committed verdict hashes

Verdict hashes below are read from the committed receipts — the same values recomputed from the canonical core and attested on `attest-ledger.testnet` (verification procedure: `docs/ARCHITECTURE.md` §Attestation flow). `block_heights` are the fork block heights recorded in each receipt.

| Attack | Target | Verdict | Verdict hash (SHA-256) | Receipt | ran_at | Fork height(s) |
|--------|--------|---------|------------------------|--------|--------|----------------|
| A1 | gateway | fall | `7343f7caf9735b8461c41d0a1f5482211d73b02b3569d1c22be846dfcb053d20` | [receipts/a1-cap-race/gateway-20261101T171313Z.json](../receipts/a1-cap-race/gateway-20261101T171313Z.json) | 2026-11-01T17:13:13Z | 57 (×8 txs) |
| A1 | reference | hold | `7271c954f69b112cd4ffcfc2353c6e1480b552e5acad9ac84c029bfbf35b454a` | [receipts/a1-cap-race/reference-20261101T171651Z.json](../receipts/a1-cap-race/reference-20261101T171651Z.json) | 2026-11-01T17:16:51Z | 64 (×8 txs) |
| A2 | gateway | fall | `7c05eff2cad246d0e05358da990c10b4c48cf1cbdeb3267f28fe0d0c8d6b4990` | [receipts/a2-freeze-bypass/gateway-20261101T171420Z.json](../receipts/a2-freeze-bypass/gateway-20261101T171420Z.json) | 2026-11-01T17:14:20Z | 43 |
| A2 | reference | hold | `1531f6ba99a9f46ee6d2fefb3eb7efc4dd82591efac056041339566f72aef735` | [receipts/a2-freeze-bypass/reference-20261101T171811Z.json](../receipts/a2-freeze-bypass/reference-20261101T171811Z.json) | 2026-11-01T17:18:11Z | 54 |
| A3 | gateway | fall | `45e8059750deaed76a638fb33d231ba38671ef8ecc73072cb6d874e8c0c40f11` | [receipts/a3-needs-review-double-spend/gateway-20261101T171453Z.json](../receipts/a3-needs-review-double-spend/gateway-20261101T171453Z.json) | 2026-11-01T17:14:53Z | 43, 46 |
| A3 | reference | hold | `fd574e68d7cfdf192685a3fc99584474441460f316e9eed44e16b0f461208063` | [receipts/a3-needs-review-double-spend/reference-20261101T171853Z.json](../receipts/a3-needs-review-double-spend/reference-20261101T171853Z.json) | 2026-11-01T17:18:53Z | 56, 61 |
| A4 | gateway | fall | `3ac2ba2e0ad0b1fb33a17e6cb5a60403a03d6b41b0ed9b470a7d7e49e36631f4` | [receipts/a4-key-scope-escape/gateway-20261101T171527Z.json](../receipts/a4-key-scope-escape/gateway-20261101T171527Z.json) | 2026-11-01T17:15:27Z | 47 |
| A4 | reference | hold | `ed4e88d049f758786e24e4385033c8a9d3412e04afc7ff3fc54631de890ac0d3` | [receipts/a4-key-scope-escape/reference-20261101T171928Z.json](../receipts/a4-key-scope-escape/reference-20261101T171928Z.json) | 2026-11-01T17:19:28Z | 50 |
| A5 | gateway | fall | `3798dd277024dd965ff631f1c8e6395f8adfadd9184d62ae6a33fd89738b4d73` | [receipts/a5-injection-to-payment/gateway-20261101T171605Z.json](../receipts/a5-injection-to-payment/gateway-20261101T171605Z.json) | 2026-11-01T17:16:05Z | 53 |
| A5 | reference | hold | `eb5f685859bd30d0badcc30453b6cfc88e694630dc382237a6e38a3f008d6762` | [receipts/a5-injection-to-payment/reference-20261101T172012Z.json](../receipts/a5-injection-to-payment/reference-20261101T172012Z.json) | 2026-11-01T17:20:12Z | 63 |

Determinism across fork heights: run 2 executed at fork height 222603395 and runs 3–4 at their own fresh-clone heights; all reproduced the hashes above, because the canonical core excludes every height- and time-bound field (`docs/ARCHITECTURE.md` §Receipt schema).

## Reproduction procedure

README steps 1–2, executed in order in one clean clone ([README.md](../README.md) §Try it):

1. `pnpm install && pnpm -r build` — builds the harness, the target simulation, and both contracts.
2. `pnpm arena:run` — full battery, both targets in one command, no secrets (`FR-9`, `SC-1` in `PRD.md` §7); expect `receipts=10` and `full_battery_gate=PASS`.

Recompute any verdict hash from its receipt file (README step 5): SHA-256 over the serialized canonical core. A recomputed hash differing from this table means the receipt on disk diverges from the committed evidence — file an issue rather than re-attesting. Fresh-run receipts are uncommitted work-in-progress and stay outside `pnpm arena:prove` unless `ARENA_PROVE_ALL=1` (`docs/specs/CONFORMANCE.md` §3).
