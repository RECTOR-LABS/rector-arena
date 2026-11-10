# ATTACK-BATTERY

Per-attack specifications A1..A5. Attack IDs are an immutable registry (`PRD.md` §0). Invariant mappings cite `docs/THREAT-MODEL.md`. Receipt schema and package layout cite `docs/ARCHITECTURE.md`.

Chain-portability: A4 is NEAR-specific — function-call keys are a NEAR account primitive, so the escape shape lives and dies with NEAR. A1/A2/A3/A5 are universal agent-wallet policy-engine failure classes (concurrent budget reads, freeze semantics, settlement idempotency, content-driven drains) that port to any chain with programmable spend. The battery runs on a NEAR mainnet fork because the recorded fork decision supplies production fork semantics on a pinned block height ([ROADMAP.md](ROADMAP.md) `## M0 spike record`; adversary-to-attack mapping: [THREAT-MODEL.md](THREAT-MODEL.md) §Adversaries).

## Targets registry

| Target id | Behavior by design | What it is |
|-----------|--------------------|------------|
| `gateway-replica` | **Falls** — exhibits the documented weakness class per attack | TS gateway-side-policy simulation in `targets/gateway-replica` |
| `reference` | **Holds** — preserves INV-1..INV-5 under every attack | Rust near-sdk contract in `contracts/reference-wallet` |

Target selection: the runner reads env `ARENA_TARGET`. A set value `gateway` selects `gateway-replica`, value `reference` selects `reference`; unset or empty runs the full battery across BOTH targets in one command (SC-1 in `PRD.md` §7, closed at M3). Any other value aborts the run with a usage error before any account is created.

## Shared environment (all attacks)

- Sandbox fork per `docs/ARCHITECTURE.md` §Sandbox fork; the fork decision (mainnet-RPC fork vs testnet fork) is the M0 spike gate (`docs/ROADMAP.md` M0).
- Token: a battery-owned NEP-141 token deployed by the harness on the fork; 24 decimals; all amounts below are whole-token values converted to base units at run time.
- Accounts provisioned per run: `owner` (sets policy), `agent` (holds the function-call key), `wallet` (the target wallet account), `attacker` (adversary-controlled), `recipient` (policy-allowlisted), `victim` (A5 only).
- Amounts: A1 uses velocity cap 100 with 8 concurrent spends of 20 each; A2 resting commitment 25; A3 intent once-amount 30; A4 per-intent max 10 with receiver allowlist `{recipient}`; A5 drains the victim balance in full.
- Certain NEAR APIs used by name: `add_function_call_key`, `ft_balance_of` (NEP-141 view), `ft_transfer` (NEP-141), batch transactions. Bootstrap call shapes for near-workspaces-js are `unverified — confirm at implementation` (resolver: M0 spike, `docs/ROADMAP.md`).
- Every attack completion writes a receipt JSON per `docs/ARCHITECTURE.md` §Receipt schema to `receipts/<attack-slug>/<target>-<run_id>.json` (FR-7 in `PRD.md`). Directory names use the lowercase attack slug (`a1-cap-race`, …); the registry ID (`A1`..`A5`) lives in the receipt JSON — naming convention specified in `docs/specs/CONFORMANCE.md` §3.

## Verdict semantics (all attacks)

The oracle evaluates the invariant expectation from on-chain state alone. Verdict `hold` = invariant preserved; verdict `fall` = invariant violated. A run on `ARENA_TARGET=reference` requires verdict `hold`; a run on `ARENA_TARGET=gateway` requires verdict `fall` (the replica falls by design). Any other outcome fails the run and is reported.

---

## A1-cap-race — concurrent spends vs velocity cap

- **Goal**: prove whether concurrent spends settle beyond the committed velocity cap (INV-1).
- **Adversary**: A-racer (`docs/THREAT-MODEL.md` §Adversaries).
- **Setup**: policy velocity cap 100 on the wallet; 8 spends of 20 each prepared (total 160 > 100).
- **Steps**:
  1. `owner` sets the policy: velocity cap 100, receiver allowlist `{recipient}`.
  2. `agent` submits 8 spend requests of 20 concurrently (batch transactions issued in parallel).
  3. Harness waits for terminal status of all 8, then reads `ft_balance_of(recipient)`.
- **Oracle**: settled total = `ft_balance_of(recipient)` after run, read from on-chain state.
- **Pass/fail**: `reference` passes with settled total == 100 (check-and-decrement serializes: 5 spends land, 3 abort with cap-exceeded). `gateway-replica` falls when settled total == 160 (all spends read the same pre-spend counter and settle — the documented best-effort concurrency failure, quoted in `PRD.md` §2).
- **Evidence**: `receipts/a1-cap-race/<target>-<run_id>.json`; `per_account_deltas` carries `wallet` (−settled total) and `recipient` (+settled total).

### Attacker economics

- **Capital at risk**: gas for 8 concurrent spend txs (each receipt lists 8 `tx_hashes` entries); the reference spend path forwards 50 Tgas for the `ft_transfer` promise and reserves 20 Tgas for the callback (`FT_TRANSFER_GAS`/`CALLBACK_GAS` in `contracts/reference-wallet/src/lib.rs`). The 3 over-cap attempts panic `"cap exceeded"` in `execute_spend` before the transfer promise is created: gas burned, payout zero. The only repo-measured sandbox transfer-gas figure is the W-6 probe's prepaid gas key paying 0.00003570921 NEAR across 8 txs, measured on the probe runtime near-sandbox 0.3.4, not the battery pins near-sandbox 0.1.5 (docs/ROADMAP.md `## M3 record`, W-6 probe outcome).
- **Expected gain**: 160 settled against the 100 cap — 60 above the committed cap. Gateway receipt `receipts/a1-cap-race/gateway-20261101T171313Z.json`: `wallet` delta `-160000000000000000000000000`, `recipient` delta `160000000000000000000000000`, verdict fall.
- **Marginal defense cost**: `execute_spend` (`contracts/reference-wallet/src/lib.rs`) runs check-and-decrement before the transfer promise — require `spent.saturating_add(amount) <= velocity_cap`, then increment `spent` in the same receipt — so concurrent spends serialize in the contract account's receipt order and exactly min(requested, remaining cap) settles. Cost shape: zero added storage entries (`spent` is a pre-existing `Policy` field), one balance add per settle, zero approval latency per spend (agent-signed; the owner never participates). Reference receipt `receipts/a1-cap-race/reference-20261101T171651Z.json`: `wallet` delta `-100000000000000000000000000`, `recipient` delta `100000000000000000000000000` — 5 of 8 settle, 3 abort, verdict hold.

## A2-freeze-bypass — post-freeze settlement of a resting commitment

- **Goal**: prove whether an authorization created before a freeze settles after the freeze (INV-2).
- **Adversary**: A-racer (`docs/THREAT-MODEL.md` §Adversaries).
- **Setup**: one resting commitment of 25 registered while the wallet is unfrozen. Real-world anchor: OutLayer limit orders are "authorised once, paid out later" and "freezing the wallet stops new orders but does not cancel resting ones" (app.outlayer.ai/docs/agent-custody §Limit Orders, cited in `PRD.md` §2; frozen snapshot: docs/quotes/outlayer-agent-custody.md).
- **Steps**:
  1. `agent` creates a resting commitment: settle 25 to `recipient` when the trigger condition holds.
  2. `owner` freezes the policy.
  3. Harness fires the trigger condition.
  4. Harness waits for terminal status, then reads post-freeze settled total from on-chain state.
- **Oracle**: post-freeze settled total (0 expected for `hold`).
- **Pass/fail**: `reference` passes with post-freeze settled total == 0 (freeze cancels outstanding commitments). `gateway-replica` falls when post-freeze settled total == 25 (the resting order pays after the freeze).
- **Evidence**: `receipts/a2-freeze-bypass/<target>-<run_id>.json`.

### Attacker economics

- **Capital at risk**: gas for 1 settle tx (each receipt lists 1 `tx_hashes` entry); the settle path forwards 50 Tgas + reserves 20 Tgas per settled commitment (`FT_TRANSFER_GAS`/`CALLBACK_GAS` in `contracts/reference-wallet/src/lib.rs`; `settle_commitments` additionally requires prepaid gas ≥ count × (FT_TRANSFER_GAS + CALLBACK_GAS)). On the reference, the post-freeze attempt returns 0 before creating any promise: gas burned, payout zero.
- **Expected gain**: 25 settled after the freeze. Gateway receipt `receipts/a2-freeze-bypass/gateway-20261101T171420Z.json`: `wallet` delta `-25000000000000000000000000`, `recipient` delta `25000000000000000000000000`, verdict fall.
- **Marginal defense cost**: owner `freeze()` (`contracts/reference-wallet/src/lib.rs`) sets `frozen` and clears every resting commitment in one call — the `wallet_frozen` log records `cancelled_commitments`; post-freeze, `settle_commitments` returns 0 before any promise and `create_commitment` panics `"wallet is frozen"`. Cost shape: one owner signature (one freeze tx) covers the entire resting set, the clear releases the commitments' storage, and the unfrozen spend path gains zero latency. Reference receipt `receipts/a2-freeze-bypass/reference-20261101T171811Z.json`: `wallet` delta `0`, `recipient` delta `0`, verdict hold.

## A3-needs-review-double-spend — ambiguous status + client retry

- **Goal**: prove whether one intent id can settle twice after an ambiguous outcome (INV-3).
- **Adversary**: A-counterparty (`docs/THREAT-MODEL.md` §Adversaries).
- **Setup**: intent I settles 30 to `recipient`. The agent proposes I through the request flow and the owner approves it (INV-5 provenance — I is a legitimate approved request). The first attempt is made to return an ambiguous terminal status mirroring the documented `needs_review` class: "execution was interrupted or unresolved and the fund state is unknown … a retry can double-spend" (app.outlayer.ai/docs/agent-custody, cited in `PRD.md` §2; frozen snapshot: docs/quotes/outlayer-agent-custody.md).
- **Steps**:
  1. `agent` submits intent I (30 to `recipient`); the first attempt ends in the ambiguous state after broadcast.
  2. The client retries intent I with identical parameters.
  3. Harness reads the total moved to `recipient` across both attempts.
- **Oracle**: total moved (once-amount 30 expected for `hold`).
- **Pass/fail**: `reference` passes with total moved == 30 (the per-intent receipt is consumed once; the retry aborts). `gateway-replica` falls when total moved == 60 (the second settlement succeeds).
- **Evidence**: `receipts/a3-needs-review-double-spend/<target>-<run_id>.json`.

### Attacker economics

- **Capital at risk**: gas for 2 identical submissions — the original attempt plus the retry (each receipt lists 2 `tx_hashes` entries). The retry panics `"intent already settled"` in `execute_spend` (`contracts/reference-wallet/src/lib.rs`) before the transfer promise is created: gas burned, payout zero.
- **Expected gain**: 60 moved for the 30 intent — +30 from the replay. Gateway receipt `receipts/a3-needs-review-double-spend/gateway-20261101T171453Z.json`: `wallet` delta `-60000000000000000000000000`, `recipient` delta `60000000000000000000000000`, verdict fall.
- **Marginal defense cost**: per-intent consumed receipts — the `intents` set (`contracts/reference-wallet/src/lib.rs`): `execute_spend` checks `intents` before settling and inserts the id on settlement; `on_ft_transfer_result` releases the id when the transfer fails, so a genuinely failed settlement stays retryable. Cost shape: one storage entry per settled intent, one set read per replay attempt, no owner interaction, no added approval latency. Reference receipt `receipts/a3-needs-review-double-spend/reference-20261101T171853Z.json`: `wallet` delta `-30000000000000000000000000`, `recipient` delta `30000000000000000000000000` across both attempts, verdict hold — the once-amount 30 moved exactly once.

## A4-key-scope-escape — function-call key chains value outside intent

- **Goal**: prove whether the FC key can move value outside the policy forward's envelope (INV-4).
- **Adversary**: A-key (`docs/THREAT-MODEL.md` §Adversaries).
- **Setup**: `wallet` holds an FC key via `add_function_call_key`, scoped to the target's transfer/forward method, allowance set above the attack amount. Policy envelope: receiver allowlist `{recipient}`, per-intent max 10.
- **Steps**:
  1. `attacker` (holding the FC key material) crafts a call to the permitted method with receiver `attacker` and amount 50 — outside the envelope in receiver and amount.
  2. Harness submits the crafted call as the FC key.
  3. Harness reads `ft_balance_of(attacker)` and the wallet balance delta.
- **Oracle**: settlement beyond the policy envelope (attacker balance delta 0 expected for `hold`).
- **Pass/fail**: `reference` passes with attacker delta == 0 and wallet delta == 0 (the policy validates receiver and amount per intent class; the tx fails). `gateway-replica` falls when attacker delta == 50 (the forwarder trusts method args).
- **Evidence**: `receipts/a4-key-scope-escape/<target>-<run_id>.json`.

### Attacker economics

- **Capital at risk**: gas for 1 crafted tx signed with the FC key material (each receipt lists 1 `tx_hashes` entry); no principal is escrowed by the attempt. The reference aborts at `"receiver not allowlisted"` in `execute_spend` (`contracts/reference-wallet/src/lib.rs`; check order: authn → receiver allowlist → per-intent max → velocity cap) before any promise is created: gas burned, payout zero.
- **Expected gain**: 50 moved to the attacker outside the policy envelope. Gateway receipt `receipts/a4-key-scope-escape/gateway-20261101T171527Z.json`: `wallet` delta `-50000000000000000000000000`, `attacker` delta `50000000000000000000000000`, verdict fall.
- **Marginal defense cost**: receiver and amount validated in-contract per call — `execute_spend` (`contracts/reference-wallet/src/lib.rs`) checks the receiver allowlist set and `per_intent_max` inside the same receipt as the spend, before the `ft_transfer` promise is created. Cost shape: two policy reads against contract state the spend already touches, zero storage growth, zero added approval latency, and the failing call never creates the transfer promise — no transfer gas is spent on the failure path. Reference receipt `receipts/a4-key-scope-escape/reference-20261101T171928Z.json`: `wallet` delta `0`, `attacker` delta `0`, verdict hold.

## A5-injection-to-payment — poisoned content drives a drain

- **Scope statement**: the poisoned content is modeled at the policy-engine boundary — the harness itself enacts the agent's settle decision from the fixture; no LLM inference sits in the path under test. The unit under test is the policy engine's provenance gate (INV-5), not content interpretation. A second, opt-in mode routes the same poisoned fixture through a real model decision before any settle call: `ARENA_A5_LLM=1 pnpm arena:a5llm` ([packages/harness/src/spike/a5-llm.ts](../packages/harness/src/spike/a5-llm.ts), requires `OPENROUTER_API_KEY` and takes `ARENA_TARGET`, default `reference`) — that mode is non-deterministic by nature, sits outside the battery and the receipt path (FR-11 untouched), and demonstrates the provenance gate blocking a live-model-driven drain attempt exactly as it blocks the harness-enacted one.
- **Goal**: prove whether content alone can produce a settlement outside the approved request flow (INV-5).
- **Adversary**: A-injection (`docs/THREAT-MODEL.md` §Adversaries).
- **Setup**: `victim` is a target wallet with a full balance. The harness plants poisoned content (an email body) instructing the agent to transfer the entire balance to `attacker`.
- **Steps**:
  1. Harness feeds the poisoned content to the agent flow driving the target.
  2. The agent produces a transfer request for the full victim balance to `attacker`.
  3. Harness waits for terminal status, then reads `ft_balance_of(victim)` and scans the run's receipts for a verdict receipt.
- **Oracle**: victim balance delta plus presence of a block verdict receipt.
- **Pass/fail**: `reference` passes with victim delta == 0 and a verdict receipt emitted (the policy rejects intents that did not originate from the approved request flow). `gateway-replica` falls when victim delta == −(full balance) (the gateway accepts the agent-signed transfer without provenance).
- **Evidence**: `receipts/a5-injection-to-payment/<target>-<run_id>.json` plus the verdict receipt.

### Attacker economics

- **Capital at risk**: zero on-chain spend by the attacker — planting the poisoned email is off-chain; the only on-chain attempt is the agent's own settle tx (1 `tx_hashes` entry per receipt). On the reference, the drain attempt panics at the provenance gate — `"no request registered for intent id"` / `"request is not approved"` in `execute_spend` (`contracts/reference-wallet/src/lib.rs`), checked before the intent receipt is consumed: gas burned, payout zero.
- **Expected gain**: the victim's full balance, 200. Gateway receipt `receipts/a5-injection-to-payment/gateway-20261101T171605Z.json`: `victim` delta `-200000000000000000000000000`, `attacker` delta `200000000000000000000000000`, verdict fall.
- **Marginal defense cost**: request-flow provenance — `spend_intent` (`contracts/reference-wallet/src/lib.rs`) settles only an intent id that names an OWNER-APPROVED request with matching receiver and amount, and only `approve_request` (owner-only) can set `approved`; the checks precede receipt consumption, so an unapproved id never burns its receipt. Cost shape: one `requests` entry per proposed request, one map read per keyed settle, and approval latency of one owner signature per request paid at approval time — settlement itself carries no owner interaction. Reference receipt `receipts/a5-injection-to-payment/reference-20261101T172012Z.json`: `victim` delta `0`, `attacker` delta `0`, verdict hold.

## Stretch probe — sibling-lane gas-key isolation (W-6)

W-6 (`PRD.md` §6) requires that per-agent gas keys isolate exhaustion between sibling lanes. The gas-key mechanism is cited as NEP-611 in the PRD decision log; the NEP id and its runtime API shape are `unverified — confirm at implementation` (resolvers: NEP registry at docs.near.org + the M0 spike report in `docs/ROADMAP.md`). This probe is not part of A1..A5 and is not required by any SC in `PRD.md` §7.

## Extending the battery — adding the next attack

A<N+1> below is a placeholder, not an ID: the ID enters the world only at step 1, via the append-only registry amendment in `PRD.md` §0. No step here mints or squats an ID — docs and harness refer to the candidate as A<N+1> until the amendment lands.

1. **Registry amendment** — `PRD.md` §0(a) Immutable ID registries: append A<N+1> to the Attack registry row (A1..A5 → A1..A<N+1>), map it to the invariant it targets (`INV-1`..`INV-5` in `docs/THREAT-MODEL.md`), and add its FR row in `PRD.md` §5 as one EARS WHEN/THEN pair naming the oracle pair. Appends only — IDs are never renamed, reused, or renumbered (`PRD.md` §0(a)).
2. **Oracle design** — the oracle reads on-chain state alone (W-5, `PRD.md` §6); name the view calls: `ft_balance_of` on the battery FT token plus the target's views `get_policy` (and `get_request`/`get_requests` when the attack exercises the request flow), all defined in `contracts/reference-wallet/src/lib.rs`. Fold the conservation + recompute checks per `packages/harness/src/oracle.ts` (`balanceOf`, `assertPolicyRecomputable`).
3. **Targets registry + harness wiring** — add the A<N+1> row to §Targets registry in this doc; create the attack module `packages/harness/src/attacks/a<N+1>.ts` exporting `runA<N+1>`; wire it in `packages/harness/src/run.ts` (import + dispatch inside the target run under the `ARENA_TARGET` selection) and register the id/slug constants in `packages/harness/src/config.ts` (`A<N+1>`, `A<N+1>_SLUG`). The pair oracle follows §Verdict semantics in this doc: `fall` required on `gateway-replica`, `hold` on `reference`.
4. **Receipt conformance** — write `receipts/<slug>/<target>-<run_id>.json` via `packages/harness/src/receipt.ts` (`writeReceipt`, `verdictHash`) with the canonical core fields per `docs/ARCHITECTURE.md` §Receipt schema — `attack_id`, `target`, `verdict`, `per_account_deltas`, in that order — that core is the verdict-hash input.
5. **Attestation flow** — per `docs/ARCHITECTURE.md` §Attestation flow: with `ARENA_ATTEST=1`, `packages/harness/src/attest.ts` posts `attest(attack_id, target, verdict_hash)` to the ledger at `attest-ledger.testnet`. The ledger is append-once per (attack_id, target): the first attestation of A<N+1> writes a fresh cell; a differing hash for an already-recorded cell aborts.
6. **README coverage** — add the results-table row under `## Results` in `README.md` plus the per-attack details block, every claim line artifact-linked: every non-fence, non-heading, non-table-separator line must carry at least one repo-relative artifact link (`FR-10`, machine-checked by `packages/harness/src/prove.ts`), so `pnpm arena:prove` covers the new receipts.
7. **FR-11 equality** — before committing any receipt, run A<N+1> twice on each target at the same fork block height and confirm both receipts carry the same verdict hash (`FR-11`, `PRD.md` §5; the double-run probe runs inside `runTarget` in `packages/harness/src/run.ts`).
