# ARCHITECTURE

Monorepo layout, runtime flow, receipt contract, and attestation flow. Requirements trace to `PRD.md` §4–§7.

## Runtime flow

```mermaid
flow LR
  H["packages/harness<br/>battery runner (TS)"] --> F["sandbox fork<br/>near-workspaces node"]
  F --> T{"ARENA_TARGET<br/>gateway | reference"}
  T --> G["targets/gateway-replica<br/>gateway-side policy sim"]
  T --> R["contracts/reference-wallet<br/>Rust near-sdk"]
  G --> O["oracle<br/>on-chain balance deltas"]
  R --> O
  O --> L["receipt ledger<br/>receipts/*.json"]
  L --> A["contracts/attest<br/>attest() on NEAR testnet"]
  A --> W["packages/web<br/>Next.js leaderboard"]
```

## Package tree

```text
rector-arena/
├── packages/
│   ├── harness/              # TS battery runner — near-workspaces driver, attacks A1..A5, oracle
│   └── web/                  # Next.js leaderboard — receipts + attestation view
├── contracts/
│   ├── reference-wallet/     # Rust near-sdk — the hardened wallet that must hold (W-1..W-5)
│   └── attest/               # Rust near-sdk — receipt attestation, deployed on NEAR testnet
├── targets/
│   └── gateway-replica/      # TS gateway-side-policy simulation — falls by design
├── receipts/                 # run output: <attack_id>/<target>-<run_id>.json
├── docs/                     # PRD.md + this doc set
├── PRD.md
└── AGENTS.md
```

## Receipt schema

One JSON object per attack run (FR-7 in `PRD.md`), written to `receipts/<attack_id>/<target>-<run_id>.json`:

```json
{
  "attack_id": "A1",
  "target": "gateway",
  "verdict": "fall",
  "per_account_deltas": [
    { "account": "wallet.testnet", "token": "battery-ft", "delta": "-160" },
    { "account": "recipient.testnet", "token": "battery-ft", "delta": "160" }
  ],
  "block_heights": [101, 104],
  "tx_hashes": ["8sJ.."],
  "ran_at": "2026-11-08T14:03:00Z"
}
```

| Field | Type | Rule |
|-------|------|------|
| `attack_id` | string | One of `A1`..`A5` (registry in `PRD.md` §0) |
| `target` | string | `gateway` (selects `gateway-replica`) or `reference` |
| `verdict` | string | `hold` or `fall` (semantics in `docs/ATTACK-BATTERY.md` §Verdict semantics) |
| `per_account_deltas` | array | `{account, token, delta}` entries; base-unit strings; recomputable from on-chain state alone (W-5) |
| `block_heights` | array | Fork/testnet block heights of the settle-attempt txs |
| `tx_hashes` | array | Transaction hashes of every settle attempt |
| `ran_at` | string | RFC 3339 UTC timestamp |

The canonical core is the verdict-hash input (FR-11 in `PRD.md` §5): the fields `attack_id`, `target`, `verdict`, `per_account_deltas`, in that order. `ran_at`, `tx_hashes`, and `block_heights` are excluded from the hash: `ran_at` and `tx_hashes` are unique per run, and `block_heights` was removed from the core at M3 — sandbox block scheduling splits concurrent gateway settle txs across blocks nondeterministically, which surfaced as a 1-in-4 FR-11 inequality on the gateway (deltas and verdict are structurally deterministic: the gateway reads its spent counter synchronously before any transfer resolves, and the reference serializes check-and-decrement in-contract). The removal is recorded in docs/ROADMAP.md `## M0 spike record` per the procedure pinned above; receipts still carry `block_heights`.

## Attestation flow

When attestation is enabled (FR-8), the harness posts `attest(attack_id, target, verdict_hash)` to the `attest` contract on NEAR testnet, where `verdict_hash` = SHA-256 of the receipt's canonical core (§Receipt schema). Verifiability: recompute the SHA-256 from the receipt file and compare against the contract state via a view call; explorer-verifiable at explorer.testnet.near.org. The `attest` contract is deployed at M3 (`docs/ROADMAP.md`). Testnet gas is funded per `PRD.md` §8.

## Sandbox fork

The M0 spike (`docs/ROADMAP.md` M0) decides mainnet-RPC fork vs testnet fork and records the measurement in that doc. Latency budget: per-tx simulation ≤ 5 s p95; node startup ≤ 120 s. The fork decision and its measured numbers are recorded in `docs/ROADMAP.md` before M1.

## Runner contract

`pnpm arena:run` executes the full battery one-command in a clean environment with no secrets (FR-9, SC-1 in `PRD.md`). `ARENA_TARGET` selects the target per `docs/ATTACK-BATTERY.md` §Targets registry. Attestation is off unless `ARENA_ATTEST=1` is set.

`pnpm arena:prove` executes the machine-proof check (FR-10, SC-4 in `PRD.md`): it parses `README.md` and fails on any claim without a link to a receipt under `receipts/` or a document under `docs/`.

`pnpm arena:web` serves the `packages/web` leaderboard (§Package tree) over the committed receipts and the live `get_attestation` view on the attest contract.
