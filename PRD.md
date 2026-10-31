# PRD — rector-arena

| Field | Value |
|-------|-------|
| Project | rector-arena — "Damn Vulnerable Agent Wallets" |
| Status | pre-alpha — docs-first scaffold; implementation starts at M0 |
| Owner | RECTOR (RECTOR-LABS) |
| Created | 2026-10-31 |
| License | MIT (LICENSE) |
| Repo | github.com/RECTOR-LABS/rector-arena (private until M4) |
| Pipeline | NEAR HACKATHON 2026-11-01 → 2026-11-14T23:59:00Z — tracks `security`, `agents`, `open` (docs/HACKATHON-EVENT.md) |

## §0 Documentation contract (rigidity & durability)

This section is the enforceable clarity contract for every doc in this repo. It is written for an agent reader with zero conversation context; `AGENTS.md` binds all future edits to it.

**(a) Immutable ID registries.** Every attack, invariant, requirement, and success criterion carries a permanent ID. IDs are never renamed, reused, or renumbered. Amendments append new IDs only. A retired ID keeps its entry; the retirement is recorded with date and reason in §11.

| Registry | IDs | Canonical definition |
|----------|-----|----------------------|
| Attack | A1..A5 | docs/ATTACK-BATTERY.md |
| Invariant | INV-1..INV-5 | docs/THREAT-MODEL.md |
| Battery requirement | FR-1..FR-10 | §5 |
| Wallet requirement | W-1..W-6 | §6 |
| Success criterion | SC-1..SC-6 | §7 |

**(b) Atomic single-interpretation statements.** One requirement per sentence. Declarative form. No compound and/or requirements. No narrative hedging around a spec.

**(c) Banned hedge vocabulary.** All repo docs ban the machine-checked hedge list maintained in `AGENTS.md` §Doc law (one-word hedges for uncertainty, tentativeness, open-endedness, and deferred decisions). The literal list lives there so the grep gate over PRD.md and docs/*.md stays clean and enforceable.

**(d) Non-finality marker.** The only permitted non-finality is the literal marker `unverified — confirm at implementation`, always paired with its named resolver (the M0 spike in docs/ROADMAP.md, or a specific doc).

**(e) Concrete quantities.** Every quantity is concrete: UTC dates, explicit budgets, amounts, latencies. Subjective adjectives ("fast", "small", "reasonable") are banned in requirements.

**(f) Cross-references.** References cite IDs or paths, never descriptions ("see A3", never "see the double-spend attack").

**(g) Glossary.** Each term is defined exactly once, here. Readers never infer terms from context.

| Term | Definition |
|------|------------|
| settlement | The on-chain FT transfer that fulfills an authorized spending intent. |
| resting commitment | An authorization created before a freeze that remains eligible for later settlement (modeled on a resting limit order). |
| intent id | The unique identifier of one approved spending request; settlement is keyed by it. |
| policy forward | The single contract entry point through which the function-call key may move value; it validates receiver and amount per intent class before settlement. |
| velocity cap | The maximum total FT amount settleable in the policy's window (100 whole-token units in A1). |
| receipt | The JSON artifact of one attack run, per docs/ARCHITECTURE.md §Receipt schema. |

## §1 Summary + non-goals

rector-arena is an open-source exploit battery that red-teams agent-wallet policy engines on a NEAR sandbox fork. The battery runs five deterministic attacks (A1..A5) against two targets: `gateway-replica` falls by design, `reference` must hold. Every attack's oracle is a recomputable balance delta read from on-chain state alone, and every run writes a receipt (docs/ARCHITECTURE.md §Receipt schema); attestation-enabled runs post the verdict hash to NEAR testnet. The hardened reference wallet survives the full battery and ships as the second deliverable — the attack and the survivor live in one repo.

**Non-goals (explicit out-of-scope):**

- No partner-product attacks. Attacks run against our own `gateway-replica` only.
- No EVM permissions leg in-window. It is a post-window roadmap item (docs/NOVELTY-POSITIONING.md §Post-window).
- No token or economics design. The battery FT is a test fixture, not a product.
- Not an end-user wallet. `reference` is a hardening reference, not a consumer product.

**Operating constraints (white-hat policy):**

- Sandbox, testnet, and dev accounts only. The battery never touches mainnet funds.
- Partner weaknesses are cited from their public docs by name (OutLayer Agent-Custody, app.outlayer.ai/docs/agent-custody — quoted in §2).
- A discovered partner 0-day halts all related work immediately and goes to private disclosure with the partner. It is never published in-repo.

## §2 Problem & why now

AI agents hold real keys, and the guardrails over those keys document best-effort enforcement. Three anchors, quoted from the OutLayer Agent-Custody docs (app.outlayer.ai/docs/agent-custody):

1. **Best-effort concurrency.** Cumulative caps "are checked against a usage counter the API gateway supplies; the TEE keeps no state of its own. If you fire several requests concurrently, they can each read the same pre-spend counter and all pass, so the cumulative caps may be exceeded by the in-flight batch." The guardrail names its own failure mode under concurrency. A1 tests this class (A-racer, docs/THREAT-MODEL.md).
2. **Freeze not cancelling resting orders.** "Freezing the wallet stops new orders but does not cancel resting ones. Cancelling is never frozen — call cancel-all after a freeze." An authorization granted before the freeze survives it, and its payout needs no further signature. A2 tests this class.
3. **Ambiguous settlement status.** `needs_review` is "terminal but special: execution was interrupted or unresolved and the fund state is unknown … do not auto-retry (the transfer may have fired, so a retry can double-spend)." Safety here depends on every client honoring a docs warning. A3 tests this class.

Two further classes complete the battery: function-call keys scope methods, not intents, so a permitted method chains into value movement the key was never meant to authorize (A4, adversary A-key); and LLM output is untrusted input that can drive the agent to sign a drain (A5, adversary A-injection — docs/THREAT-MODEL.md §Trust boundaries).

**Why now.** NEAR's agentic economy is shipping: the NEAR HACKATHON `security` track names "spending limits, policy engines, sandboxed wallets" as its build theme and function-call keys plus TEE attestation as its stack (docs/HACKATHON-EVENT.md §Tracks). Screening itself is machine-executed — organizers run AI reproducibility checks over every project before humans judge (docs/HACKATHON-EVENT.md, rule Q-017) — so a repo's claims must resolve to runnable artifacts. No public harness proves policy-engine failure with settlement on a real fork; the empty cell is documented with named prior art in docs/NOVELTY-POSITIONING.md §Claim. This repo is built so every claim links to a receipt or doc artifact (FR-10, SC-4).

## §3 Threat model & invariants (constitution)

Assets, adversaries, and trust boundaries: docs/THREAT-MODEL.md.

| ID | Invariant | Tested by |
|----|-----------|-----------|
| INV-1 | Concurrency cannot settle beyond the committed cap | A1 |
| INV-2 | Freeze ⇒ zero future settlement from prior authorizations | A2 |
| INV-3 | Settlement is idempotent per intent id | A3 |
| INV-4 | The FC key cannot move value outside the policy forward | A4 |
| INV-5 | No settlement originates outside the policy-approved request flow | A5 |

Stated immutable: every milestone in docs/ROADMAP.md preserves all five invariants.

## §4 Architecture

pnpm monorepo with four moving parts: `packages/harness` (TypeScript, near-workspaces driver — runs A1..A5, computes oracles, writes receipts), `targets/gateway-replica` (TypeScript gateway-side-policy simulation — falls by design), `contracts/reference-wallet` + `contracts/attest` (Rust, near-sdk — the hardened wallet and the testnet attestation contract), and `packages/web` (Next.js leaderboard over receipts). The harness selects the target via `ARENA_TARGET` (docs/ATTACK-BATTERY.md §Targets registry) and runs against the sandbox fork decided at M0. Full flow diagram, package tree, receipt schema, and attestation flow: docs/ARCHITECTURE.md.

## §5 Attack battery requirements (EARS)

Requirement statements follow `WHEN <trigger> THE SYSTEM SHALL <response>` (EARS, alistairmavin.com/ears; registries rendered with THEN as the shall-form). Full per-attack specs: docs/ATTACK-BATTERY.md.

- FR-1: WHEN A1 runs with target=gateway THEN over-cap settlement lands.
- FR-2: WHEN A1 runs with target=reference THEN settled total == cap exactly.
- FR-3: WHEN A2 runs THEN the replica settles post-freeze AND the reference settles 0.
- FR-4: WHEN A3 runs THEN the replica double-settles AND the reference settles the once-amount.
- FR-5: WHEN A4 runs THEN the replica settles outside the policy envelope AND the reference does not.
- FR-6: WHEN A5 runs THEN the replica drains the victim AND the reference leaves the balance unchanged and emits a verdict receipt.
- FR-7: WHEN any attack completes THEN a receipt JSON per the docs/ARCHITECTURE.md schema is written.
- FR-8: WHEN attestation is enabled THEN an attest tx is posted per receipt and is explorer-verifiable on testnet.
- FR-9: WHEN the battery runs in a clean environment THEN no secrets are required.
- FR-10: WHEN any README claim is read THEN it links to a receipt or doc artifact.

## §6 Hardened-wallet requirements (EARS)

- W-1: WHEN concurrent spends reach the policy contract THEN the settled sum == min(requested, remaining cap).
- W-2: WHEN freeze executes THEN resting commitments cancel AND post-freeze settlement == 0.
- W-3: WHEN an intent id replays THEN the second attempt fails AND the total moved is unchanged.
- W-4: WHEN an FC key calls any contract other than the policy forwarder THEN the tx fails.
- W-5: WHEN a settlement occurs THEN the policy state transition is recomputable from on-chain state alone.
- W-6 (stretch): WHEN NEP-611 gas keys are issued per agent THEN one agent's exhaustion cannot affect sibling lanes.

## §7 Success criteria & demo script

| ID | Criterion |
|----|-----------|
| SC-1 | The full battery runs one-command in a clean environment, no secrets (docs/ARCHITECTURE.md §Runner contract). |
| SC-2 | The reference wallet preserves INV-1..INV-5 under the full battery. |
| SC-3 | Receipts are attested on NEAR testnet and explorer-verifiable. |
| SC-4 | The README passes the machine-proof check: every claim links to a receipt or doc artifact. |
| SC-5 | A 90-second demo video is recorded: gateway red flip → reference green → injection blocked. |
| SC-6 | The submission payload is confirmed and the POST returns 201 before 2026-11-14T23:59:00Z. |

**Judge narrative (PR/FAQ).** Judges asking why this exists get one answer: the cell is empty and dup-checked. docs/NOVELTY-POSITIONING.md pins eleven named neighbors — DVAA's FlightBot exfiltrates against a synthetic wallet; Gray Swan Arena and UK AISI run closed arenas over simulated ledgers; AgentDojo, InjecAgent, R-Judge, and ASB score wrong actions in simulation; the Consensys Diligence wallet-permissions audit and QuillAudits' agentic-wallet post are point-in-time artifacts; Damn Vulnerable DeFi v4 proved the fork-backed-battery format for protocols — and none executes a financial exploit against the agent-wallet policy engine itself on a real NEAR fork, with settlement. The impact is hardening rails for NEAR's agentic-economy push: every agent-wallet builder on NEAR can run the battery against their own design for free, then adopt the reference wallet's five invariants (INV-1..INV-5) as a checklist. The demo is the 90-second red-flip-to-green (SC-5): the same five attacks drain the gateway replica and leave the reference wallet untouched, each verdict attested on testnet (SC-3).

## §8 Edge cases & environment assumptions

| Assumption | Handling |
|------------|----------|
| Sandbox fork state freshness vs mainnet | The fork is a snapshot; state drifts from mainnet after the snapshot height. The harness records the fork block height in every receipt (docs/ARCHITECTURE.md §Receipt schema). The battery depends only on battery-owned contracts and FT. |
| FT availability on the fork | The battery deploys its own NEP-141 token on the fork. No external token dependency exists. |
| RPC rate limits | Attack traffic stays on the local sandbox node. Public-RPC usage is limited to testnet attestation; attestation retries 3 attempts with 2 s backoff, same `verdict_hash`. |
| near-workspaces version pin | The exact version is pinned in `packages/harness/package.json` at M1. The pin value is resolved during M0 (docs/ROADMAP.md §M0 spike record). |
| Testnet faucet dependency | Attestation needs testnet NEAR for gas. It is funded via the faucet per docs/HACKATHON-EVENT.md (rule Q-008); the M3 record in docs/ROADMAP.md states the required balance and funding tx. |

## §9 Risks, drawbacks, alternatives

Pre-mortem top 3, each with a pre-decided response:

| # | Risk | Pre-decided response |
|---|------|----------------------|
| 1 | M0 latency gate fails: per-tx sim > 5 s p95 or node startup > 120 s | Pivot documented in docs/ROADMAP.md before M1: testnet fork, or mocked-state runner. The pivot choice is recorded with the M0 measurements. |
| 2 | Single-maintainer bandwidth | Battery-scope cut order pre-decided in docs/ROADMAP.md §Scope-cut order: A5, then A3, then A2. A1 and A4 are never cut. Each cut is logged in §11 with date and reason. |
| 3 | Arena misread as an end-user wallet product | Fixed positioning one-liner on all surfaces: "Damn Vulnerable Agent Wallets — an open arena that hunts agent-wallet policy engines on NEAR, and ships the wallet that survives." The non-goal is restated in §1. |

Rejected designs:

| Design | Why rejected |
|--------|--------------|
| EVM permissions leg in-window | Claim/repo mismatch risk under AI screening (docs/HACKATHON-EVENT.md rule Q-017). It is a post-window roadmap item (docs/NOVELTY-POSITIONING.md §Post-window). |
| Direct partner-product attacks | White-hat boundary: own replicas only; partner weaknesses cited from public docs by name (§1 operating constraints). |

Novelty positioning one-liner: the §Claim block in docs/NOVELTY-POSITIONING.md. Every claim surface reproduces it verbatim (FR-10).

## §10 Task plan with traceability

Acceptance details live in docs/ROADMAP.md; this table fixes the traceability.

| Milestone | Window (UTC) | Acceptance | Closes |
|-----------|--------------|------------|--------|
| M0 — spike gate | 2026-11-01 | Per-tx sim ≤ 5 s p95 AND node startup ≤ 120 s; FAIL → pivot documented before M1 | §8 fork assumption; prerequisite for FR-1..FR-10 |
| M1 — harness + gateway falls | 2026-11-02 → 2026-11-05 | A1 + A4 green both directions; receipts written; clean-env run | FR-1, FR-2, FR-5, FR-7, FR-9; W-1, W-4 |
| M2 — reference holds | 2026-11-05 → 2026-11-08 | A2 + A3 green both targets; reference survives A1, A2, A4 | FR-3, FR-4; W-2, W-3 |
| M3 — settlement proof on-chain | 2026-11-08 → 2026-11-11 | A5 green; attest contract on testnet; full battery one-command clean env | FR-6, FR-8; SC-1, SC-2, SC-3; W-5; W-6 (stretch attempt) |
| M4 — proof + public flip | 2026-11-11 → 2026-11-12 | Leaderboard renders receipts; README machine-proof pass; repo public | FR-10; SC-4 |
| M5 — demo + submit | 2026-11-13 | Video recorded; X-post draft delivered; POST returns 201 before 2026-11-14T23:59:00Z | SC-5, SC-6 |

Buffer: 2026-11-14 is reserved for retrying any M5 step (one submission per repository; retries reuse the same `requestId` — docs/HACKATHON-EVENT.md §Payload contract).

## §11 Decision log

Dated entries. This section carries zero open questions at handoff. Implementation-time unknowns carry the `unverified — confirm at implementation` marker with a named resolver inside the owning doc (docs/ATTACK-BATTERY.md §Stretch probe; docs/ROADMAP.md §M0 spike record) — never an open question here.

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-31 | Product pick: novelty-first exploit battery + survivor wallet | The cell — a financial exploit against the agent-wallet policy engine on a real NEAR fork, with settlement — is empty after a dup-check across eleven named neighbors (docs/NOVELTY-POSITIONING.md). |
| 2026-10-31 | NEAR-native claim only; the EVM permissions leg is post-window | README claims == repo contents under AI screening (docs/HACKATHON-EVENT.md rule Q-017). The leg is deferred, not claimed (docs/NOVELTY-POSITIONING.md §Post-window). |
| 2026-10-31 | gateway-replica white-hat strategy | Attacks run against our own replica; partner weaknesses are cited from public docs by name; a partner 0-day halts work and goes to private disclosure (§1 operating constraints). |
| 2026-10-31 | PRD format: agent-consumed hybrid — Spec Kit testable requirements, EARS statements, RFC prior-art discipline, PR/FAQ judge narrative | Screening and implementation are agent-executed; §0 is the enforceable zero-ambiguity contract for that reader. |
