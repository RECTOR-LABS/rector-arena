# rector-arena — starter prompt (implementation session)

Paste the block below into a fresh omp session with cwd at the repo. Scaffold state: PRD + full doc set pushed to `github.com/RECTOR-LABS/rector-arena` (private, `main` @ `7874ba4`, 2026-10-31) — zero product code by design; implementation starts from the docs.

```
You are picking up rector-arena — RECTOR's NEAR HACKATHON entry (window 2026-11-01 → 2026-11-14T23:59:00Z UTC; tracks security / agents / open). The scaffold is complete and pushed: PRD + full doc set, zero product code by design. Implement from the docs.

Repo: ~/local-dev/RECTOR-LABS/rector-arena

Read in this order, then work:
1. PRD.md — §0 documentation contract is LAW for every file you touch: immutable IDs (A1..A5, INV-1..INV-5, FR-1..FR-11, W-1..W-6, SC-1..SC-6 — never renamed/reused/renumbered, amendments append only); hedges banned (literal list in AGENTS.md §Doc law); the only non-finality marker is `unverified — confirm at implementation` paired with a named resolver; cross-references cite IDs or paths, never descriptions.
2. docs/ROADMAP.md — work the earliest open milestone.
3. docs/ATTACK-BATTERY.md — the per-attack spec you implement (targets registry, verdict semantics, oracles).
4. docs/ARCHITECTURE.md — package tree, receipt JSON schema, runner contract, attestation flow.

Your job: implement the earliest open milestone. First gate = M0 spike (2026-11-01): boot the sandbox fork with live state, simulate one battery-owned NEP-141 transfer, measure. Acceptance: per-tx sim ≤ 5 s p95 AND node startup ≤ 120 s. On FAIL, document the pivot (testnet fork or mocked-state runner) in docs/ROADMAP.md §M0 spike record before M1 — fill the spike record there either way.

Locked decisions — do not re-open:
- NEAR-native claim only; the EVM permissions leg is post-window (docs/NOVELTY-POSITIONING.md §Post-window).
- Repo stays private until M4 (flip 2026-11-12; hard rule: public by 2026-11-14T23:59:00Z).
- MIT; no AI attribution anywhere.
- No CI until the M1 review (org Actions budget is quota-constrained).
- Direct-to-main commits, prefixes `feat|fix|chore|docs:`, never squash — solo sprint, no branch protection.
- Secrets only via .env symlinked to ~/Documents/secret/rector-arena/.env; the battery itself runs secret-free (FR-9).

Stack: pnpm monorepo · TypeScript strict · Rust near-sdk contracts · Next.js leaderboard · 2-space indent.

Discipline:
- Proof = receipts. Every attack run writes a receipt JSON per docs/ARCHITECTURE.md §Receipt schema; oracle values come from on-chain state alone (W-5). Tests support; receipts prove.
- Unknowns get the `unverified — confirm at implementation` marker + resolver — never a silent choice, never an open question added to the PRD.
- Reference docs by ID/path per §0(f).
- Submission (M5) is human-gated: leadName, email, nearAddress, demoUrl come from RECTOR; print the full payload and wait for an explicit yes; ONE POST; reuse the same requestId on retry. Never post to X on RECTOR's behalf. Contract: docs/HACKATHON-EVENT.md §Payload contract.
- Friction found while building → note it in the session summary (no tracker until the M4 public flip).
```
