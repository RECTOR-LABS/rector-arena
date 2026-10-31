# Frozen snapshot — OutLayer Agent-Custody docs

- Source: https://app.outlayer.ai/docs/agent-custody
- Fetched: 2026-10-31 (reader-mode fetch of the live page)
- Purpose: verbatim evidence for the three partner-doc anchors quoted in `PRD.md` §2 and cited by `docs/ATTACK-BATTERY.md` (A2, A3). The live page changes without notice; this snapshot pins the wording the PRD quotes. Re-check against the live page at the M4 machine-proof pass (FR-10, SC-4 in `PRD.md`).
- Scope: the three quoted sections only, verbatim with source emphasis. PRD quotes strip markdown emphasis and mark truncations with ` …`; wording is otherwise character-identical.

---

## Policy Engine — "Velocity limits are best-effort under concurrency"

Per-transaction limits, whitelists, time windows, capabilities, freeze, and the multisig trigger are enforced **exactly** inside the TEE on every signature. The **cumulative** limits — daily / hourly / monthly spend and the hourly transaction-count (`rate_limit`) — are checked against a usage counter the API gateway supplies; the TEE keeps no state of its own. If you fire several requests **concurrently**, they can each read the same pre-spend counter and all pass, so the cumulative caps may be exceeded by the in-flight batch (e.g. a “60 tx/hour” cap could admit a few extra under a burst). Single-threaded agents (one request at a time) are unaffected.

## Withdraw — status values

**Status values (exact).** The withdraw/swap row returned by `GET /wallet/v1/requests/{id}` holds only these `status` strings: `processing` (keep polling), `success`, `failed` (a 1Click refund/expiry is normalized to `failed`; reason in `result.reason`), and `needs_review`. On a multisig wallet the submit can return `pending_approval` / `approved` / `rejected` instead. Do **not** invent synonym sets (`settled`/`completed`/…) — none of those are emitted.

**`needs_review` is terminal but special:** execution was interrupted or unresolved and the fund state is unknown. Surface it as “needs manual review” — **do not auto-retry** (the transfer may have fired, so a retry can double-spend). Without handling it you would poll forever.

## Limit Orders

A limit order is a swap that waits for your price. The wallet says what it sells (or buys), how much, and at what price; the order rests on 1Click and fills — possibly in several slices — when the market reaches it. It ends when it is filled, cancelled, or reaches its deadline (7 days unless you set one). **Mainnet only**, funded from the wallet's intents balance.

**Authorised once, paid out later.** Every other operation here is signed as money moves; a resting order is not. The policy decides when the order is created, and the payout happens later — possibly days later — with no further signature. Two consequences: a price through the market fills *immediately*, so an order is gated as the exit it can become; and freezing the wallet stops new orders but does not cancel resting ones. Cancelling is never frozen — call `cancel-all` after a freeze, with the same API key.
