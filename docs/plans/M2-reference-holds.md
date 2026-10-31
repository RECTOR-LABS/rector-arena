# M2 — reference holds

| Field | Value |
|-------|-------|
| Milestone | M2 — reference holds |
| Window (UTC) | 2026-11-05 → 2026-11-08 |
| Closes | FR-3, FR-4; W-2, W-3 |
| Acceptance authority | docs/ROADMAP.md row M2 |

Execution spec for M2. Subordinate to docs/ROADMAP.md row M2; on any conflict ROADMAP wins. Citations follow PRD.md §0(f): IDs and §anchors, never restated canonical content.

## Objective

The reference contract survives A2 + A3 and is re-proven against A1 + A4 — the survival set is A1, A2, A3, A4 (PRD.md §10 row M2 acceptance). The gateway replica falls on both new attacks; the reference holds on all four.

## Prerequisites

M1 green both directions: 4 receipts on disk with exact oracle values (docs/plans/M1-harness-gateway.md Verification), `pnpm arena:run` green end-to-end.

## Work breakdown

Steps run in order. Each names its action and its done-condition.

1. **Implement freeze cancellation in `contracts/reference-wallet`.** `freeze` cancels every resting commitment so post-freeze settlement == 0 (W-2: "every resting commitment is permanently un-settleable", PRD.md §6). — Done: A2 with `ARENA_TARGET=reference` reads post-freeze settled total 0.
2. **Implement per-intent idempotency in `contracts/reference-wallet`.** A per-intent receipt is consumed exactly once — a replayed intent id fails and the total moved is unchanged (W-3, PRD.md §6). — Done: A3 with `ARENA_TARGET=reference` reads total moved 30.
3. **Implement attack module A2.** Resting commitment 25 registered while unfrozen → `owner` freezes → trigger fires → harness reads the post-freeze settled total, per docs/ATTACK-BATTERY.md §A2-freeze-bypass (that section owns the step list and oracle). — Done: the module runs under both targets.
4. **Implement attack module A3.** Intent I settles 30; the first attempt ends in the ambiguous terminal status after broadcast; an identical retry follows; the harness reads the total moved across both attempts, per docs/ATTACK-BATTERY.md §A3-needs-review-double-spend (mirrors the `needs_review` class, PRD.md §2 anchor 3). — Done: the module runs under both targets.
5. **Re-prove the survival set.** Re-run A1 + A4 with `ARENA_TARGET=reference`; the harness asserts verdicts `hold` for A1, A2, A3, A4 on the reference (PRD.md §10 row M2 acceptance; docs/ROADMAP.md row M2). — Done: all four reference runs report `hold`, and `pnpm arena:run` covers all 8 runs.

## Requirement mapping

| ID | M2 evidence | Anchor |
|----|-------------|--------|
| FR-3 | gateway settles 25 post-freeze / reference 0 | PRD.md §5 |
| FR-4 | gateway total moved 60 / reference 30 | PRD.md §5 |
| W-2 | freeze leaves every resting commitment permanently un-settleable | PRD.md §6 |
| W-3 | replayed intent id fails; total moved unchanged | PRD.md §6 |
| W-1, W-4 | re-verified under the grown battery | docs/ROADMAP.md row M2 |
| INV-2, INV-3 | observed by A2, A3 on the reference | docs/THREAT-MODEL.md §Invariants |

## Verification

Run from the repo root at M2 close:

1. `find receipts -type f -name '*.json' | wc -l` → `8` (A1..A4 × gateway/reference; `<run_id>` varies per run).
2. Oracle pairs exact: A2 post-freeze settled total 25 (gateway) / 0 (reference); A3 total moved 60 (gateway) / 30 (reference); A1 and A4 unchanged from M1.
3. `pnpm arena:run` exits 0 end-to-end.

| Check | Expected |
|-------|----------|
| receipt count | 8 |
| A2 oracle pair | 25 vs 0 |
| A3 oracle pair | 60 vs 30 |
| runner | exit 0 |

## Pre-decided responses

The scope-cut order (docs/ROADMAP.md §Scope-cut order: A5, then A3, then A2; A1 and A4 never cut) puts A3 first, then A2, at risk under bandwidth pressure. Any cut is logged in PRD.md §11 with date and reason — no silent shrink.

## Non-finality markers

None. M2 cites only resolved inputs and mints no marker.
