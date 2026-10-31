# NOVELTY-POSITIONING

Prior-art map for the rector-arena novelty claim. Every neighbor is cited by name with a pinned URL. URLs pinned and re-verified 2026-10-31; re-verify at the M4 README machine-proof pass (SC-4 in `PRD.md`).

## Neighbors

| # | Project | URL | What it is | Delta — why it does not fill the cell |
|---|---------|-----|------------|----------------------------------------|
| 1 | agent-security-harness | github.com/msaleme/red-team-blue-team-agent-fabric | Red/blue-team harness for agent HTTP integrations | HTTP-protocol sentinels only. README grep for `anvil\|foundry\|EVM\|wallet-policy\|spend-cap` = 0 hits (re-verified 2026-10-31). No chain, no wallet policy engine, no settlement oracle. Iterates weekly. |
| 2 | DVAA — damn-vulnerable-ai-agent | github.com/opena2a-org/damn-vulnerable-ai-agent | Deliberately vulnerable AI-agent platform (Docker fixtures; agents 7015–7021) | Static appsec fixtures. FlightBot (7017) = indirect injection via web fetch → wallet exfiltration against a **synthetic** wallet. No chain, no fork, no settlement. Nearest wallet-adjacent neighbor, cited by name. |
| 3 | Gray Swan Arena | grayswan.ai/solutions/for-model-builders/arena | Hosted red-team arena for AI agents ($300K challenge platform) | Closed hosted arena; researchers attack agents behind Gray Swan's wall over simulated ledgers. Not forkable, nothing settles on a public chain, no runnable open-source battery. |
| 4 | UK AISI | aisi.gov.uk | National pre-deployment AI evaluations | Closed access agreements. No public, self-hostable exploit battery against agent wallets. |
| 5 | AgentDojo | github.com/ethz-spylab/agentdojo | Prompt-injection task suite for agents | Wrong-action detection in simulation. Nothing settles; no wallet policy engine as target. |
| 6 | InjecAgent | github.com/uiuc-kang-lab/InjecAgent | Indirect prompt-injection benchmark for tool-integrated agents | Wrong-action labels in simulation. Nothing settles. |
| 7 | R-Judge | github.com/Lordog/R-Judge | Safety benchmark scoring agent interaction records | Simulation scoring. Nothing settles. |
| 8 | ASB — Agent Security Bench | github.com/agiresearch/ASB | ICLR 2025 benchmark: 10 attack scenarios vs LLM agents | Simulation-only scenarios (incl. financial tools). Nothing settles on chain. |
| 9 | Consensys Diligence — MetaMask ERC-7715 Permissions Snap audit | diligence.security/audits/2025/08/metamask-eip-7715-permissions-snap | Point-in-time security audit of one wallet-permissions implementation | One implementation, one snapshot in time, EVM. Not a repeatable battery, not fork-backed, no settlement-proofing oracle. |
| 10 | QuillAudits — Agentic Wallet Security | quillaudits.com/blog/web3-security/Agentic-Wallet-Security | Prose threat listing: session keys, spending caps, risks | Prose only. No tooling, no oracle, no PoCs, nothing runnable. |
| 11 | Damn Vulnerable DeFi v4 | github.com/theredguild/damn-vulnerable-defi | Fork-backed CTF for DeFi protocol exploits | Format lineage this repo credits: fork-backed battery + oracle per challenge. Target is protocol contracts — no agent, no policy engine, no LLM in the loop, no agent-held keys. |

## Claim

> Existing public work probes payment protocols over HTTP, statically fixtures agent tooling (including injection→wallet-exfiltration against synthetic wallets), or red-teams agents in simulated ledgers behind closed arenas — none publicly executes a financial exploit against the agent-wallet policy engine itself (spend caps, freezes, settlement receipts, function-call-key scoping) on a real NEAR fork, with settlement.

This is the repo's only novelty claim. Every surface that states a claim (README, PRD §7) reproduces this block verbatim and links here (FR-10 in `PRD.md`).

## Closing window

The empty cell is open on 2026-10-31. Neighbor #1 iterates weekly, and agent-wallet policy engines are shipping on NEAR now (OutLayer Agent-Custody documents its guardrail semantics at app.outlayer.ai/docs/agent-custody). Claiming the cell is day-1 work: the fork-backed battery is the M0–M3 build in `docs/ROADMAP.md`. The claim holds only while the battery exists and runs — SC-1 and SC-4 in `PRD.md` keep it audit-traceable.

## Post-window

A future leg ports the battery to the ERC-7715 wallet-permissions surface (EVM, eips.ethereum.org/EIPS/eip-7715; audited reference implementation: neighbor #9). This leg is a post-hackathon roadmap item and is **explicitly not claimed now** — the in-window claim is NEAR-native only (`PRD.md` §1, §11).
