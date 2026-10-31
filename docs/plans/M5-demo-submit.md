# M5 — demo + submit

| Field | Value |
|-------|-------|
| Milestone | M5 — demo + submit |
| Window (UTC) | 2026-11-13 (buffer 2026-11-14) |
| Closes | SC-5, SC-6 |
| Acceptance authority | docs/ROADMAP.md row M5 |

Execution spec for M5. Subordinate to docs/ROADMAP.md row M5; on any conflict ROADMAP wins. Citations follow PRD.md §0(f): IDs and §anchors, never restated canonical content.

## Objective

The 90-second demo video exists, the X-post draft is delivered to RECTOR, and the submission POST returns 201 before 2026-11-14T23:59:00Z.

## Prerequisites

M4 done: repo public, README proof-green (docs/plans/M4-proof-public-flip.md Verification).

## Work breakdown

Steps run in order. Each names its action and its done-condition. The human gates (docs/HACKATHON-EVENT.md Submission checklist) are absolute: the agent never posts to X on RECTOR's behalf and never sends the submission without an explicit yes.

1. **Record the demo video.** 90 seconds, beats exactly: gateway red flip → reference green → injection blocked (PRD.md §7 SC-5; docs/HACKATHON-EVENT.md Submission checklist item 2). — Done: the video exists and RECTOR reviews it.
2. **Draft the X post.** From the template in docs/HACKATHON-EVENT.md §X-post draft template; deliver the draft to RECTOR — the human posts it, never the agent (Submission checklist item 3). — Done: RECTOR holds the draft and returns the post URL, which becomes `demoUrl`.
3. **Assemble the submission payload.** Per docs/HACKATHON-EVENT.md §Payload contract. Pre-decided values: `projectName` = `rector-arena`; `size` = `1`; `tracks` = `["security","agents","open"]`; `projectUrl` = `https://github.com/RECTOR-LABS/rector-arena`; `idea` drafted from PRD.md §1 and approved verbatim by RECTOR. HUMAN-only values, never guessed or placeholder-filled: `leadName`, `email`, `nearAddress`, `demoUrl`, `consent`. Body ≤ 12000 bytes. Never add a `website` field — any non-empty value rejects the submission (spam trap, §Payload contract). The contact notice in §Payload contract is read to RECTOR verbatim before `consent` flips true. — Done: the payload JSON is assembled with all pre-decided values and awaits the human fields.
4. **Generate `requestId`.** `uuidgen | tr A-Z a-z`, generated once, stored outside the repo; a retry after network error or 503 reuses the same value (§Payload contract). — Done: the value is stored outside the repo and reused on every retry.
5. **Send the submission.** Print the full payload → explicit RECTOR yes → single POST to `https://nearhackathon.com/api/applications` (docs/HACKATHON-EVENT.md, Submission API). Response handling: 201 = saved, report to RECTOR; 400 = fix the named fields, resend with the same `requestId`; 403/409 = stop and ask — never retry around a refusal; 413 = shorten `idea`; 503 = wait, resend with the same `requestId`. The payload file is never committed (it carries personal data). — Done: a 201 is recorded, or a stop condition is escalated to RECTOR.
6. **Respect the buffer.** 2026-11-14 is reserved for retrying any M5 step only (PRD.md §10 buffer note). Before any buffer-day submit, re-read the live `https://nearhackathon.com/HACKATHON.md` — the verbatim copy in docs/HACKATHON-EVENT.md was fetched 2026-10-31; dates and rules can change. — Done: any buffer-day action is taken against the re-read live copy.

## Requirement mapping

| ID | M5 evidence | Anchor |
|----|-------------|--------|
| SC-5 | 90-second video: gateway red flip → reference green → injection blocked | PRD.md §7; docs/ROADMAP.md row M5 |
| SC-6 | POST returns 201 before 2026-11-14T23:59:00Z | PRD.md §7; docs/HACKATHON-EVENT.md §Payload contract |

## Verification

At M5 close:

1. The POST response is 201, timestamped before 2026-11-14T23:59:00Z.
2. The demo post is live on X with the video attached, and its URL equals the submitted `demoUrl`.

| Check | Expected |
|-------|----------|
| POST response | 201 before the deadline |
| demo post | live, video attached, URL == `demoUrl` |

## Pre-decided responses

None. The human gates are absolute (docs/HACKATHON-EVENT.md Submission checklist).

## Non-finality markers

None. M5 cites only resolved inputs and mints no marker.
