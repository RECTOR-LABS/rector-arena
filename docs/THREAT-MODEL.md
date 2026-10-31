# THREAT-MODEL

Assets, adversaries, trust boundaries, and the invariants the arena tests. Invariant IDs (INV-1..INV-5) and attack IDs (A1..A5) are immutable registries defined in `PRD.md` §0.

## Assets

| Asset | Definition | Lost when |
|-------|------------|-----------|
| Wallet funds | The FT balance held by the target wallet account on the sandbox fork | Any settlement outside the policy envelope, or settlement beyond a cap |
| Policy integrity | Caps, freeze, idempotency, and request-flow semantics enforce exactly as specified | A1..A5 oracle shows settlement that violates INV-1..INV-5 |
| Attestation verifiability | Receipts posted on-chain (testnet) match receipts on disk | `verdict_hash` on chain does not recompute from the receipt JSON |

## Adversaries

| ID | Adversary | Capability | Attacks |
|----|-----------|------------|---------|
| A-key | Key thief — holds the agent's function-call key (leaked or exfiltrated) | Signs contract calls as the agent within key scope | A4 |
| A-counterparty | Malicious contract — the counterparty the agent legitimately interacts with | Crafts settlement calls, replays intents, returns ambiguous outcomes | A1 (secondary), A3 |
| A-injection | Poisoned content source — email, post body, or fetched page the agent reads | Steers the agent to sign a value-moving request | A5 |
| A-racer | Parallel spender — fires concurrent requests against the same policy | Races pre-spend counter reads and post-freeze settlement windows | A1, A2 |

## Trust boundaries

1. **LLM output = untrusted input.** Any plan, argument, or receiver the agent produces is adversary-controllable (A-injection). Nothing downstream treats it as authorization by itself.
2. **Gateway-side state = untrusted.** Off-chain usage counters, gateway process memory, and gateway-built artifacts sit outside the trust root. A-racer and A-key exploit this layer.
3. **On-chain reference-wallet state = trusted root.** The reference contract's state transitions are the only trusted basis. All oracles recompute verdicts from on-chain state alone (W-5 in `PRD.md` §6).

## Invariants (constitution)

Every milestone in `docs/ROADMAP.md` preserves all five. Violations are observed by the mapped attack, not assumed.

| ID | Invariant | Tested by | Primary adversary |
|----|-----------|-----------|-------------------|
| INV-1 | Concurrency cannot settle beyond the committed velocity cap | A1 | A-racer |
| INV-2 | A freeze produces zero future settlement from prior authorizations | A2 | A-racer |
| INV-3 | Settlement is idempotent per intent id | A3 | A-counterparty |
| INV-4 | The function-call key cannot move value outside the policy forward | A4 | A-key |
| INV-5 | No settlement originates outside the policy-approved request flow | A5 | A-injection |

Invariant vocabulary is defined once in `PRD.md` §0 (glossary): settlement, resting commitment, intent id, policy forward, velocity cap, receipt.
