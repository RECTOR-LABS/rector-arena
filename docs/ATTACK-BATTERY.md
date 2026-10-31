# ATTACK-BATTERY

Per-attack specifications A1..A5. Attack IDs are an immutable registry (`PRD.md` §0). Invariant mappings cite `docs/THREAT-MODEL.md`. Receipt schema and package layout cite `docs/ARCHITECTURE.md`.

## Targets registry

| Target id | Behavior by design | What it is |
|-----------|--------------------|------------|
| `gateway-replica` | **Falls** — exhibits the documented weakness class per attack | TS gateway-side-policy simulation in `targets/gateway-replica` |
| `reference` | **Holds** — preserves INV-1..INV-5 under every attack | Rust near-sdk contract in `contracts/reference-wallet` |

Target selection: the runner reads env `ARENA_TARGET`; value `gateway` selects `gateway-replica`, value `reference` selects `reference`. Any other value, or an unset variable, aborts the run with a usage error before any account is created.

## Shared environment (all attacks)

- Sandbox fork per `docs/ARCHITECTURE.md` §Sandbox fork; the fork decision (mainnet-RPC fork vs testnet fork) is the M0 spike gate (`docs/ROADMAP.md` M0).
- Token: a battery-owned NEP-141 token deployed by the harness on the fork; 24 decimals; all amounts below are whole-token values converted to base units at run time.
- Accounts provisioned per run: `owner` (sets policy), `agent` (holds the function-call key), `wallet` (the target wallet account), `attacker` (adversary-controlled), `recipient` (policy-allowlisted), `victim` (A5 only).
- Amounts: A1 uses velocity cap 100 with 8 concurrent spends of 20 each; A2 resting commitment 25; A3 intent once-amount 30; A4 per-intent max 10 with receiver allowlist `{recipient}`; A5 drains the victim balance in full.
- Certain NEAR APIs used by name: `add_function_call_key`, `ft_balance_of` (NEP-141 view), `ft_transfer` (NEP-141), batch transactions. Bootstrap call shapes for near-workspaces-js are `unverified — confirm at implementation` (resolver: M0 spike, `docs/ROADMAP.md`).
- Every attack completion writes a receipt JSON per `docs/ARCHITECTURE.md` §Receipt schema to `receipts/<attack_id>/<target>-<run_id>.json` (FR-7 in `PRD.md`).

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

## A2-freeze-bypass — post-freeze settlement of a resting commitment

- **Goal**: prove whether an authorization created before a freeze settles after the freeze (INV-2).
- **Adversary**: A-racer (`docs/THREAT-MODEL.md` §Adversaries).
- **Setup**: one resting commitment of 25 registered while the wallet is unfrozen. Real-world anchor: OutLayer limit orders are "authorised once, paid out later" and "freezing the wallet stops new orders but does not cancel resting ones" (app.outlayer.ai/docs/agent-custody §Limit Orders, cited in `PRD.md` §2).
- **Steps**:
  1. `agent` creates a resting commitment: settle 25 to `recipient` when the trigger condition holds.
  2. `owner` freezes the policy.
  3. Harness fires the trigger condition.
  4. Harness waits for terminal status, then reads post-freeze settled total from on-chain state.
- **Oracle**: post-freeze settled total (0 expected for `hold`).
- **Pass/fail**: `reference` passes with post-freeze settled total == 0 (freeze cancels outstanding commitments). `gateway-replica` falls when post-freeze settled total == 25 (the resting order pays after the freeze).
- **Evidence**: `receipts/a2-freeze-bypass/<target>-<run_id>.json`.

## A3-needs-review-double-spend — ambiguous status + client retry

- **Goal**: prove whether one intent id can settle twice after an ambiguous outcome (INV-3).
- **Adversary**: A-counterparty (`docs/THREAT-MODEL.md` §Adversaries).
- **Setup**: intent I settles 30 to `recipient`. The first attempt is made to return an ambiguous terminal status mirroring the documented `needs_review` class: "execution was interrupted or unresolved and the fund state is unknown … a retry can double-spend" (app.outlayer.ai/docs/agent-custody, cited in `PRD.md` §2).
- **Steps**:
  1. `agent` submits intent I (30 to `recipient`); the first attempt ends in the ambiguous state after broadcast.
  2. The client retries intent I with identical parameters.
  3. Harness reads the total moved to `recipient` across both attempts.
- **Oracle**: total moved (once-amount 30 expected for `hold`).
- **Pass/fail**: `reference` passes with total moved == 30 (the per-intent receipt is consumed once; the retry aborts). `gateway-replica` falls when total moved == 60 (the second settlement succeeds).
- **Evidence**: `receipts/a3-needs-review-double-spend/<target>-<run_id>.json`.

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

## A5-injection-to-payment — poisoned content drives a drain

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

## Stretch probe — sibling-lane gas-key isolation (W-6)

W-6 (`PRD.md` §6) requires that per-agent gas keys isolate exhaustion between sibling lanes. The gas-key mechanism is cited as NEP-611 in the PRD decision log; the NEP id and its runtime API shape are `unverified — confirm at implementation` (resolvers: NEP registry at docs.near.org + the M0 spike report in `docs/ROADMAP.md`). This probe is not part of A1..A5 and is not required by any SC in `PRD.md` §7.
