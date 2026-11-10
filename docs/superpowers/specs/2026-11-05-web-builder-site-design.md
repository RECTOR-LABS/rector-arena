# Builder Site Design — packages/web expansion

Date: 2026-11-05. Author: CIPHER session with RECTOR. Status: implemented on `feat/web-builder-site` (2026-11-05); this document reflects the built state.

## Intent and why

`PRD.md` §7 states the impact line: every agent-wallet builder on NEAR can run the battery against their own design for free, then adopt the reference wallet's five invariants (INV-1..INV-5) as a checklist. Today the only public surface for that builder is the README (written for judges and reproducers) and the leaderboard (a receipts table). Neither onboards a builder.

RECTOR picked approach B (builder adoption site) on 2026-11-05, over a judge-first landing. The site's job: a NEAR agent-wallet builder lands on `arena.rectorspace.com` and leaves able to (1) run the full battery one-command in a clean environment, (2) read what each attack proves and how the oracle decides, (3) verify every verdict on-chain without trusting this site, (4) see how the battery extends to new attacks and targets.

The hackathon context stays binding: the submission deadline is 2026-11-14T23:59:00Z (SC-6) and M5 (demo video, SC-5) is planned for 2026-11-13. All site pages land by 2026-11-10 so M5 keeps its buffer.

## Goals

- G1 — Run it: from `/battery` alone, a builder executes `pnpm arena:run` in a clean environment with no secrets (FR-9, SC-1) and knows what a run emits.
- G2 — Attack catalog: `/attacks` presents A1..A5, each with weakness class, mechanic, oracle, pass/fail amounts, live verdicts from the committed receipts, attestation state, a link to the receipt JSON, and a deep link to the spec in the repo.
- G3 — Verify it: `/verify` documents the trust path end-to-end: receipt canonical core, SHA-256 verdict hash, `get_attestation` view on `attest-ledger.testnet`, explorer check. A builder can recompute every hash from the receipt file alone.
- G4 — Extend it: `/building` documents the extension contract as it exists in code: the targets registry, the shape of an attack module, oracle rules (on-chain state alone, W-5), receipt emission (FR-7), and the determinism rule (FR-11 canonical core).
- G5 — Live proof strip: `/` renders current verdicts from the committed receipts and the live attestation view, using the same data layer as the leaderboard.

## Non-goals

- No judge-story page: the hero carries one proof line; the narrative lives in the README and the 90-second video (SC-5).
- No battery execution from the site, no RPC re-runs, no user accounts, no analytics, no CMS. Results shown are the committed receipts; attestation state is the live testnet view.
- No new deploy infrastructure: the existing Vercel project `web` serves everything; pushes to `main` auto-deploy (`rootDirectory: packages/web`, set 2026-11-10) and the flat upload `vercel deploy packages/web --prod` stays as the manual fallback (procedure in `packages/web/AGENTS.md`).
- No changes to `packages/harness`, `contracts/`, `targets/`, or `receipts/` content.
- Not an end-user wallet page: the "hardening reference, not a consumer product" guard (`PRD.md` §1 non-goals) stays in the site footer on every page.

## Anti-goals (failure even if it works)

- A number on the site with no receipt or doc artifact behind it (FR-10 spirit: every claim links to an artifact).
- An unattested or integrity-failing verdict rendered as verified.
- Marketing copy that outruns the fixed positioning (`PRD.md` §9: "Damn Vulnerable Agent Wallets — an open arena that hunts agent-wallet policy engines on NEAR, and ships the wallet that survives").

## Constraints

- Doc law (`PRD.md` §0): the banned hedge vocabulary applies to site copy as well; quantities are concrete; IDs (A1..A5, INV-1..INV-5, FR-x, W-x, SC-x) are cited verbatim, never paraphrased into new names.
- Hallmark floor (`/Users/rector/.agents/skills/hallmark/`, v2.0.0) binds the UI build: every colour and font through a token in `app/theme.css`; no `transition: all`; `prefers-reduced-motion` honored site-wide; `:focus-visible` everywhere; no em dashes or middle-dot-joined meta strings in copy; sentence case labels; stamp + waivers live in the first lines of `app/theme.css`.
- Next.js 16 app router (`packages/web/AGENTS.md` warning block): the builder reads `node_modules/next/dist/docs/` for the installed version before writing route code.
- Data path: pages read the committed snapshot in `packages/web/public/receipts` through `lib/receipts.ts`; attestation state through `lib/attest.ts` (JSON-RPC `get_attestation` on `attest-ledger.testnet`, fastnear-first provider). Pages that read receipts or query attestation are `force-dynamic` so `next build` does zero fs/RPC work.
- Theme (decided 2026-11-05, supersedes the earlier dark-look draft): nearhackathon paper-terminal, adapted by request. Warm paper `#e9e1cd`, ink `#322e25`, NEAR blue `#005fb0`, destructive `#b53124`, borders `#b7ac94`, radius 0, IBM Plex Mono 400/500/600 body, Pixelify Sans 500 display, all vendored as OFL TTFs under `public/fonts/`. The `--hold` green is `#166534` (contrast-corrected from nearhackathon's `#1a7f37`, which measures 4.12:1 on card; floor gate 40 requires 4.5:1).
- shadcn/ui (style base-nova, Base UI primitives) supplies Button, Card, Badge, Tabs, Slider, Separator; components live under `packages/web/components/ui/`, site components under `packages/web/app/components/`. The tsconfig alias is `@/* -> ./*`, so site components import as `@/app/components/...`. A Button rendering a Next `<Link>` passes `nativeButton={false}` (Base UI requirement). lucide-react has no brand icons; GitHub links use text.
- `README.md` line 212 links `http://localhost:3000/leaderboard` and `https://arena.rectorspace.com/leaderboard` explicitly; `pnpm arena:prove` must still pass.
- TypeScript strict, 2-space indent, no `any` escapes on public APIs (repo conventions).

## Approaches considered (RECTOR picked B on 2026-11-05)

- A — Judge-first landing: one story page at `/`, leaderboard moves to `/leaderboard`. Strongest for the 2026-11-13 judge click-through; weakest for the PRD §7 impact line. Rejected: B's hero carries the same one-line proof, so the judge case is covered inside B.
- B — Builder adoption site (PICKED): quickstart-first home plus attack catalog, verify flow, and extension docs. Serves the post-hackathon life of the repo; more content work than A or C.
- C — A plus one run-it page: middle ground. Rejected by RECTOR: the builder layer deserves more than one page.
- D — Leaderboard polish only: rejected: the demo X post would link to a raw table with no story and no onboarding.

## Decided (final state, as built)

- Platform: the existing `packages/web` Next.js app. One app, one Vercel project, one domain (`arena.rectorspace.com`). No second site or deploy.
- Route map (nine routes, final):

| Route | Content |
|-------|---------|
| `/` | Hero ("Damn Vulnerable Agent Wallets" in Pixelify display face, one sentence, primary CTA "Run the battery" to `/battery`, outline CTA "Watch it fall and hold" to `/simulate`), verdict sequencer (five receipt-backed rows A1..A5 with fall/hold amounts and live attestation badges, staged entry, Replay control, stamped custom posture "command-deck"), proof strip with receipt count linking `/verify` |
| `/battery` | Prerequisites from README Try-it step 1, terminal card with `pnpm arena:run` + the committed sample output (fr11=equal, gate=PASS, receipts=10) with a copy button, ARENA_TARGET/ARENA_ATTEST variants, measured envelope (startup 528 ms / 120 s budget, per-tx p95 2021 ms / 5 s), what a run emits |
| `/simulate` | Client-side replay of the committed battery parameters with an honest line pointing at the real harness: cap-race sim (slider N=1..8, deterministic gateway/reference outcomes, real A1 hashes), freeze sim (4-step scripted timeline, real A2 hashes), injection sim (4 steps, real A5 hashes); reduced-motion renders final states immediately |
| `/attacks` | A1..A5 cards: weakness class (README results-table wording verbatim), adversary (linked to docs/THREAT-MODEL.md #adversaries), mechanic, oracle, gateway fall / reference hold amounts, live attestation badges, receipt JSON links, spec deep links to docs/ATTACK-BATTERY.md anchors |
| `/impact` | PRD §7 thesis verbatim as the opening statement; four sections: documented gap (OutLayer snapshot quote fragments), the INV-1..INV-5 checklist (PRD §3 wording verbatim), verifiability as a NEAR feature (SC-3, contracts/attest append-once pattern), free and open (MIT, FR-9, NOVELTY-POSITIONING §Claim fragment) |
| `/verify` | Canonical core definition and field order, the exact recompute command with its expected hash `7343f7ca…d20` (verified equal to the receipt's verdict_hash), the get_attestation view call, the explorer link, trust framing (append-once, conflicting hash panics, ARENA_ATTEST_CONTRACT override), the four states table |
| `/building` | Extension contract as it exists: targets registry semantics (usageFail exit 2), ArenaTarget interface, attack module shape (runA<N>, config constants, writeReceipt/verdictHash), oracle rules (W-5), FR-11 determinism, ID immutability (A6+ via PRD §0 amendment) |
| `/how-it-works` | Inline SVG flow diagram (mainnet fork through attested leaderboard, token vars only, aria-labelled), three paragraphs: two targets, the oracle (W-5), the fork (M0 envelope) |
| `/leaderboard` | The former `app/page.tsx` moved from `/`, links absolutized (`/{repoPath}`, GitHub blob URLs), classes remapped to tokens |

- Shared chrome: edge-aligned nav (wordmark in Pixelify face, eight route links, GitHub text link, one primary "Run the battery" button, mobile disclosure below lg); footer with mast line, three link columns (Project, Evidence, Docs) and the MIT + guard + type-credit bottom line.
- Data contract: `lib/receipts.ts` and `lib/attest.ts` untouched; pages compose them.
- Copy module: `lib/attack-copy.ts` holds the per-attack copy (weakness, adversary, mechanic, oracle, fall/hold amounts, spec anchor), joined with live rows on `/attacks`.
- Hallmark process: preflight cached at `.hallmark/preflight.json` (gitignored); hero reviewed in fresh context (verdict: ship); stamp, waivers (44c), answers (F18) and dismissals (58) recorded in `app/theme.css`; `.hallmark/` build cache stays out of git.
- Demo video: `/` gains a "watch the 90-second demo" link when the SC-5 video lands on 2026-11-13; no placeholder before that date.

## Verification for this work

`pnpm -r build` clean; `tsc --noEmit` clean for the web package; `pnpm arena:web` with all nine routes visited locally (200 + spot greps); `pnpm arena:prove` PASS after the README line-212 edit; sloplint sweep per route (0 FAIL, reflexes fixed or waived on the record); then `vercel deploy packages/web --prod` and a hosted check that all nine routes return 200 with live attestation cells on `/leaderboard`.
