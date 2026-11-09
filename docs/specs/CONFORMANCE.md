# CONFORMANCE

Normative conformance spec for targets scored by the arena battery. A target conforms when it satisfies every numbered requirement in §1–§5. ID registries (A1..A5, INV-1..INV-5, W-*, SC-*) are immutable and defined in `PRD.md` §0; this spec cites IDs, never redefines them.

## 1. Oracle-pair contract

| Requirement | ID | Statement |
|-------------|----|-----------|
| C-1 | W-5 | Every oracle reads on-chain state alone. The verdict is recomputed from `ft_balance_of` view calls and the target's on-chain policy state; harness-internal truth never decides a verdict (`PRD.md` §6; oracle implementation: `packages/harness/src/oracle.ts`). |
| C-2 | — | The pair contract: `gateway-replica` MUST produce verdict `fall` and `reference` MUST produce verdict `hold` on every attack A1..A5 (`docs/ATTACK-BATTERY.md` §Verdict semantics; §Targets registry). A run that returns any other outcome fails the run. |
| C-3 | — | A registered target declares its expected verdict per attack in the targets registry; the runner fails the run when the observed verdict differs from the declaration. |

## 2. Invariants as checkable requirements

Each invariant resolves to one measured on-chain quantity per attack. Requirement text restates `docs/THREAT-MODEL.md` §Invariants (constitution); mapping is unchanged.

| ID | Checkable requirement | Attack | Measured quantity | Hold value | Fall value |
|----|----------------------|--------|-------------------|-----------|------------|
| INV-1 | No settlement exceeds the committed velocity cap under any concurrency | A1 | `ft_balance_of(recipient)` after 8 concurrent spends of 20 against cap 100 | 100 (5 settle, 3 abort cap-exceeded) | 160 |
| INV-2 | A freeze yields zero future settlement from prior authorizations | A2 | post-freeze settled total from `ft_balance_of(recipient)` | 0 | 25 |
| INV-3 | Settlement is idempotent per intent id under client retry | A3 | total moved across both attempts, `ft_balance_of(recipient)` | 30 | 60 |
| INV-4 | The function-call key moves zero value outside the policy envelope (receiver allowlist `{recipient}`, per-intent max 10) | A4 | `ft_balance_of(attacker)` delta | 0 | 50 |
| INV-5 | Zero settlement originates outside the approved request flow | A5 | `ft_balance_of(victim)` delta | 0 | −200 |

## 3. Receipt canonical core

The canonical core of a receipt is `attack_id`, `target`, `verdict`, `per_account_deltas`, in that order; it is the sole verdict-hash input (FR-11 in `PRD.md` §5). `docs/ARCHITECTURE.md` §Receipt schema is the canonical field table — the core, the excluded fields (`ran_at`, `tx_hashes`, and `block_heights`, excluded because they are unique-per-run or nondeterministic-by-scheduling), and the base-unit string encoding are defined there and are not restated here. The verdict hash is SHA-256 over the serialized core (`packages/harness/src/receipt.ts`, `verdictHash`); attestation posts it to `attest-ledger.testnet` per `docs/ARCHITECTURE.md` §Attestation flow. A conforming receipt carries exactly one core, recomputable from the file.

**Receipt-path convention.** Receipts are written to `receipts/<attack-slug>/<target>-<run_id>.json` (`FR-7` in `PRD.md`): the directory name is the lowercase slug (`a1-cap-race` .. `a5-injection-to-payment`, constants `A1_SLUG`..`A5_SLUG` in `packages/harness/src/config.ts`), while the JSON payload `attack_id` field carries the registry ID (`A1`..`A5`). The slug is a path convention; the ID inside the JSON is authoritative — tooling that maps a receipt to the registry reads `attack_id`, not the directory name.

**Prove-scoping behavior.** `pnpm arena:prove` (FR-10, SC-4 in `PRD.md` §7) scores only the git-committed receipts: receipts produced by a fresh run before commit are uncommitted work-in-progress and stay outside the proof, so a README proof pass and a battery run in the same tree do not contaminate each other. `ARENA_PROVE_ALL=1` widens the scan to every `*.json` under `receipts/` (`packages/harness/src/prove.ts`; runner contract: `docs/ARCHITECTURE.md` §Runner contract).

## 4. Bring-your-own-wallet conformance checklist

A third target registers and conforms through these steps, in order:

1. **Register** — add one row to §Targets registry in `docs/ATTACK-BATTERY.md`: target id, declared behavior per attack (expected `hold`/`fall` verdicts for A1..A5), and what the target is. Registration is a documentation amendment under the `PRD.md` §0 contract, not a code change.
2. **Implement the target surface** — the target must accept the battery's spend/commitment/request calls and expose the on-chain state the oracles read: `ft_balance_of` on the battery FT token plus the policy views (`get_policy`, and `get_request`/`get_requests` when the attack exercises the request flow — view definitions: `contracts/reference-wallet/src/lib.rs`).
3. **Wire the runner** — add the target dispatch under `ARENA_TARGET` in `packages/harness/src/run.ts`; the runner aborts on any value outside the registered set (`docs/ARCHITECTURE.md` §Runner contract).
4. **Emit conforming receipts** — every run of the target writes one receipt per attack with the §3 canonical core, at the §3 path convention, carrying the registry ID in `attack_id`.
5. **Prove FR-11 equality** — run the target twice per attack at the same fork block height before committing any receipt; both receipts MUST carry the identical verdict hash. A differing hash fails registration (`FR-11` in `PRD.md` §5; the double-run probe runs inside `runTarget` in `packages/harness/src/run.ts`).
6. **Score the pair** — the oracle-pair contract (§1, C-2/C-3) scores the target against `gateway-replica` (falls) and `reference` (holds): a target declaring `hold` on an attack is measured against the reference's hold value in §2; a target declaring `fall` is measured against the gateway's fall value.

## 5. Worked example — A1 against a hypothetical strict-policy target

Battery constants (`packages/harness/src/config.ts`, `A1`: spend 20, concurrency 8) with the velocity cap set to 50 in place of the shipped default — `A1.cap` ships as 100; receiver allowlist `{recipient}`; total requested 8 × 20 = 160 > 50.

**Gateway-semantics result (expected `fall`, C-2).** The gateway replica reads its spent counter synchronously in process memory before any transfer resolves (`targets/gateway-replica`), so all 8 spends read the same pre-spend headroom of 50 and all 8 settle: settled total = 8 × 20 = 160, which exceeds the cap by 160 − 50 = 110. The verdict is `fall` and the receipt deltas are `wallet` −160, `recipient` +160 (this is exactly the observed gateway behavior at the default cap 100: 160 settled, receipt `receipts/a1-cap-race/gateway-20261101T171313Z.json`).

**Strict on-chain counter result (expected `hold`, C-2).** A target enforcing the cap in on-chain state serializes the 8 spends in contract-receipt order with a check-and-decrement: admit while `spent + amount <= cap` (`contracts/reference-wallet/src/lib.rs:164` — `policy.spent.saturating_add(amount) <= policy.velocity_cap, "cap exceeded"`, inside `execute_spend`, state mutated before the transfer promise per the comment at `lib.rs:100-103`). Arithmetic over the 20-unit spends:

- spend 1: 0 + 20 = 20 ≤ 50 → settle, `spent` = 20
- spend 2: 20 + 20 = 40 ≤ 50 → settle, `spent` = 40
- spend 3: 40 + 20 = 60 > 50 → abort `"cap exceeded"`; spends 4–8 read the same `spent` = 40 and abort identically

Landing: 2 spends settle (2 × 20 = 40), 6 abort. The hold number is 40, not 50: the invariant bounds settlement at the cap, and the 20-unit spends are indivisible, so the settled total stops at the largest multiple of 20 that fits — floor(50 ÷ 20) = 2 spends. The receipt records `wallet` −40, `recipient` +40, verdict `hold`. Under the reference's default cap 100 the same semantics admit floor(100 ÷ 20) = 5 spends (100 settled, 3 abort) — the observed reference receipt `receipts/a1-cap-race/reference-20261101T171651Z.json` shows exactly that (deltas ±100, verdict `hold`).

A strict-policy target passing A1 at cap 50 therefore produces a distinct verdict hash from the reference at cap 100 — different `per_account_deltas` in the canonical core — while both satisfy INV-1.
