# AGENTS.md — rector-arena

Project context for agent sessions working in this repo. The master doc is `PRD.md`; its §0 documentation contract is law for every file here.

## What this is

RECTOR's NEAR HACKATHON entry (window 2026-11-01 → 2026-11-14T23:59:00Z; tracks `security`, `agents`, `open` — docs/HACKATHON-EVENT.md). rector-arena ("Damn Vulnerable Agent Wallets") is an open-source exploit battery that red-teams agent-wallet policy engines on a NEAR sandbox fork, plus the hardened reference wallet that survives the full battery.

## Stack

- pnpm monorepo; TypeScript strict; Rust with near-sdk for contracts; Next.js for `packages/web`.
- Harness driver: near-workspaces (version pinned at M1 — docs/ROADMAP.md §M0 spike record).

## Doc map — read in this order

1. `PRD.md` — requirements, invariants, registries, decision log.
2. `docs/ROADMAP.md` — milestones M0..M5; work the earliest open milestone.
3. `docs/ATTACK-BATTERY.md` — the spec you implement per attack.
4. `docs/ARCHITECTURE.md` — package tree, receipt schema, runner contract.

## Conventions

- 2-space indent; TS strict; no `any` escapes on public APIs.
- Commits: `feat|fix|chore|docs:` prefixes. Never squash. Direct-to-main commits are allowed during this solo hackathon sprint (no branch protection on this repo).
- Secrets: per-repo `.env` (gitignored), symlinked to `~/Documents/secret/rector-arena/.env`. Never hardcode keys; the battery itself runs secret-free (FR-9).
- No CI until the M1 review — org Actions budget is quota-constrained; do not add workflows before then.
- No AI attribution anywhere (commits, docs, code).
- Dogfooding: friction found while building → note it in the session summary (no tracker until the M4 public flip).

## Doc law (binds every future doc edit)

`PRD.md` §0 is the enforceable contract:

- IDs are immutable: A1..A5, INV-1..INV-5, FR-1..FR-10, W-1..W-6, SC-1..SC-6 are never renamed, reused, or renumbered. Amendments append new IDs only.
- Cross-references cite IDs or paths, never descriptions.
- Banned hedge vocabulary in all repo docs: `maybe`, `might`, `TBD`, `TODO`, `flexible`, `as needed`, `if possible`, `consider adding`, and `etc.` after a requirement. (This list lives here so the grep gate over `PRD.md` and `docs/*.md` stays clean and enforceable.)
- The only permitted non-finality is the literal marker `unverified — confirm at implementation`, paired with its named resolver.
- Quantities are concrete: UTC dates, explicit amounts, budgets, latencies.
- The glossary in `PRD.md` §0(g) defines domain vocabulary exactly once — extend it there, never inline.
