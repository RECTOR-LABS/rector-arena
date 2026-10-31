# M4 — proof + public flip

| Field | Value |
|-------|-------|
| Milestone | M4 — proof + public flip |
| Window (UTC) | 2026-11-11 → 2026-11-12 |
| Closes | FR-10; SC-4 |
| Acceptance authority | docs/ROADMAP.md row M4 |

Execution spec for M4. Subordinate to docs/ROADMAP.md row M4; on any conflict ROADMAP wins. Citations follow PRD.md §0(f): IDs and §anchors, never restated canonical content.

## Objective

The README survives the machine-proof check, the leaderboard renders the receipts, and the repo is public.

## Prerequisites

M3 green: 10 receipts on disk, attest txs resolving on the explorer, one-command full battery from a fresh clone (docs/plans/M3-settlement-proof.md Verification). Attestation live.

## Work breakdown

Steps run in order. Each names its action and its done-condition.

1. **Build `packages/web`.** Next.js leaderboard per docs/ARCHITECTURE.md §Package tree: reads `receipts/` and the `contracts/attest` view; renders per-attack verdict rows for both targets. — Done: the leaderboard renders all 10 receipts.
2. **Rewrite README.md.** Every claim links to a receipt under `receipts/` or a doc under `docs/` (FR-10). Machine-reader section per the Q-017 guidance in docs/HACKATHON-EVENT.md: what the product is, the problem, "do X — see Y" try-steps. The novelty claim block stays verbatim, linked to docs/NOVELTY-POSITIONING.md §Claim. No marketing. — Done: README contains no unlinked claim.
3. **Implement `pnpm arena:prove`.** Per docs/ARCHITECTURE.md §Runner contract: parse README.md, fail on any claim without a receipt/docs link; make it pass (PRD.md §7 SC-4). — Done: `pnpm arena:prove` exits 0.
4. **Re-check the partner-doc quotes.** Compare the three §2 quotes of PRD.md against docs/quotes/outlayer-agent-custody.md and the live page (PRD.md §1 snapshot constraint). — Done: all three confirmed byte-identical to the frozen snapshot, or drift is escalated to RECTOR before the flip.
5. **Flip the repo public.** Agent executes the flip, RECTOR approves (docs/HACKATHON-EVENT.md Submission checklist item 1). Hard rule: public by 2026-11-14T23:59:00Z; planned 2026-11-12. — Done: the repo is reachable without authentication.

## Requirement mapping

| ID | M4 evidence | Anchor |
|----|-------------|--------|
| FR-10 | every README claim links to a receipt or doc artifact | PRD.md §5; docs/ROADMAP.md row M4 |
| SC-4 | `pnpm arena:prove` passes | PRD.md §7; docs/ARCHITECTURE.md §Runner contract |

## Verification

Run from the repo root at M4 close:

1. `pnpm arena:prove` → exit 0.
2. The leaderboard renders all 10 receipts with verdict rows for both targets.
3. The repo URL `https://github.com/RECTOR-LABS/rector-arena` is reachable in a logged-out browser session.

| Check | Expected |
|-------|----------|
| `pnpm arena:prove` | exit 0 |
| leaderboard | 10 receipts rendered |
| repo visibility | public before 2026-11-14T23:59:00Z |

## Pre-decided responses

If the arena is misread as an end-user wallet product, apply the PRD.md §9 risk 3 positioning one-liner, cited verbatim: "Damn Vulnerable Agent Wallets — an open arena that hunts agent-wallet policy engines on NEAR, and ships the wallet that survives." The non-goal is restated in PRD.md §1.

## Non-finality markers

None. M4 cites only resolved inputs and mints no marker.
