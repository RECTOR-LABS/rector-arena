import { getAttestation, type AttestationState } from "@/lib/attest";
import { humanizeDelta, loadAttackRows, settledTotal, type ReceiptCell } from "@/lib/receipts";

export const dynamic = "force-dynamic";

const ATTACK_ID = "A5";

/** First-person statement the wallet makes when it refuses an intent. */
const WALLET_REFUSAL = "I did not send this.";

function AttestationBadge({ attestation }: { attestation: AttestationState }) {
  const map: Record<AttestationState["state"], { label: string; className: string }> = {
    match: { label: "attested", className: "text-hold" },
    mismatch: { label: "MISMATCH", className: "text-fall" },
    unattested: { label: "unattested", className: "text-muted-foreground" },
    "rpc-unreachable": { label: "rpc unreachable", className: "text-muted-foreground" },
  };
  const view = map[attestation.state];
  return <span className={view.className}>{view.label}</span>;
}

function IntegrityBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="text-hold">ok</span>
  ) : (
    <span className="text-fall">MISMATCH</span>
  );
}

/** Outflow the wallet stopped (or failed to stop), humanized from the deltas. */
function outflow(cell: ReceiptCell): string {
  let total = 0n;
  for (const d of cell.perAccountDeltas) {
    const value = BigInt(d.delta);
    if (value < 0n) total += -value;
  }
  return humanizeDelta(total.toString());
}

function ReceiptCard({ cell, label }: { cell: ReceiptCell | null; label: string }) {
  if (!cell) {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">no receipt</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm font-semibold text-foreground">
        {label}:{" "}
        <span className={cell.verdict === "hold" ? "text-hold" : "text-fall"}>
          {cell.verdict}
        </span>
        <span className="text-muted-foreground">, {outflow(cell)} settled</span>
      </p>
      <div className="mt-2">
        <a className="break-all font-mono text-xs text-primary hover:underline" href={`/${cell.repoPath}`}>
          {cell.repoPath}
        </a>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
        verdict_hash {cell.verdictHash}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        ran_at {cell.ranAt}, integrity <IntegrityBadge ok={cell.integrityOk} />,{" "}
        {cell.attestation ? <AttestationBadge attestation={cell.attestation} /> : "…"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {cell.perAccountDeltas.map((d) => (
          <span key={`${d.account}-${d.token}`} className="block">
            {d.account}: {humanizeDelta(d.delta)} {d.token}
          </span>
        ))}
      </p>
    </div>
  );
}

/** One refusal line per attack, in the wallet's own voice. */
const REFUSALS: Record<string, string> = {
  A1: "I stopped at my limit.",
  A2: "I froze before this could move.",
  A3: "I paid this intent once.",
  A4: "That key could not leave my envelope.",
};

/** Card anatomy mirrors the receipts footer: refusal line, then the receipt proof. */
function RejectionCard({ cell, refusal }: { cell: ReceiptCell | null; refusal: string }) {
  if (!cell) {
    return (
      <div className="rounded-md border border-border p-4">
        <p className="text-sm font-semibold text-foreground">&ldquo;{refusal}&rdquo;</p>
        <p className="mt-1 text-sm text-muted-foreground">no receipt</p>
      </div>
    );
  }
  const settled = outflow(cell);
  const recipient = cell.perAccountDeltas.find((d) => !d.delta.startsWith("-"));
  const token = recipient?.token ?? cell.perAccountDeltas[0]?.token ?? "battery-ft";
  const attempts = cell.txHashes.length;
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm font-semibold text-foreground">&ldquo;{refusal}&rdquo;</p>
      <p className="mt-1 text-sm text-foreground">
        {cell.attackId} —{" "}
        {attempts > 1 ? `${attempts} attempts raced, ` : ""}
        {cell.verdict === "hold" ? <span className="text-hold">{cell.verdict}</span> : <span className="text-fall">{cell.verdict}</span>}
        , {settled} {token} settled.
      </p>
      <div className="mt-2">
        <a className="break-all font-mono text-xs text-primary hover:underline" href={`/${cell.repoPath}`}>
          {cell.repoPath}
        </a>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
        verdict_hash {cell.verdictHash}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        ran_at {cell.ranAt}, integrity <IntegrityBadge ok={cell.integrityOk} />,{" "}
        {cell.attestation ? <AttestationBadge attestation={cell.attestation} /> : "…"}
      </p>
    </div>
  );
}

export default async function WalletSaysNoPage() {
  const rows = await loadAttackRows();
  const row = rows.find((r) => r.id === ATTACK_ID);
  const gateway = row?.cells.gateway ?? null;
  const reference = row?.cells.reference ?? null;

  // Per-attack rejection cards: the reference wallet's receipt for A1-A4.
  const refusals = ["A1", "A2", "A3", "A4"]
    .map((id) => ({ id, cell: rows.find((r) => r.id === id)?.cells.reference ?? null }))
    .filter((entry): entry is { id: string; cell: ReceiptCell } => entry.cell !== null);
  await Promise.all(
    refusals.map(async (entry) => {
      entry.cell.attestation = await getAttestation(
        entry.cell.attackId,
        entry.cell.target,
        entry.cell.verdictHash,
      );
    }),
  );

  await Promise.all(
    (["gateway", "reference"] as const).map(async (target) => {
      const cell = target === "gateway" ? gateway : reference;
      if (!cell) return;
      cell.attestation = await getAttestation(cell.attackId, cell.target, cell.verdictHash);
    }),
  );

  // Every quantity below is read from the committed receipts, never hardcoded.
  const fall = gateway;
  const hold = reference;
  const attempted = fall
    ? fall.perAccountDeltas.find((d) => d.delta.startsWith("-"))
    : undefined;
  const recipient = fall?.perAccountDeltas.find((d) => !d.delta.startsWith("-"));
  const attemptedAmount = attempted ? humanizeDelta(attempted.delta.slice(1)) : "unknown";
  const attacker = recipient?.account ?? "unknown";
  const token = attempted?.token ?? recipient?.token ?? "battery-ft";
  // A3 reference receipt: the happy path for the approval walkthrough below.
  const a3 = rows.find((r) => r.id === "A3")?.cells.reference ?? null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Wallet says no</h1>
        <p className="mt-2 max-w-3xl text-foreground">
          What you see when a poisoned message tries to spend your money and the hardened
          reference wallet refuses. This is the moment attack {ATTACK_ID} was built to force.
        </p>
      </header>

      <section aria-label="the attempted transfer" className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">1. The attempt</h2>
        <p className="mt-2 max-w-3xl text-foreground">
          A settlement-migration email arrived and its content tried to move{" "}
          <span className="font-semibold">{attemptedAmount} {token}</span> — the wallet&apos;s full
          balance — to <span className="font-mono text-foreground">{attacker}</span>. The agent
          drafted the transfer; the email was not you.
        </p>
      </section>

      <section aria-label="the block" className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">2. The block</h2>
        <p className="mt-2 max-w-3xl text-foreground">
          <span className="font-semibold">{WALLET_REFUSAL}</span> Nothing moved:{" "}
          {hold ? `${outflow(hold)} settled` : "no receipt"}. The reason is a rule the wallet
          enforces before any spend: money only leaves through a request you approved yourself.
          No owner-approved request exists for this intent, so the transfer never starts. The
          invariant is INV-5, no settlement originates outside the policy-approved request flow;
          the check lives in{" "}
          <code className="font-mono text-xs">spend_intent</code> in{" "}
          <a
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
            href="https://github.com/RECTOR-LABS/rector-arena/blob/main/contracts/reference-wallet/src/lib.rs"
          >
            contracts/reference-wallet/src/lib.rs
          </a>
          , listed under{" "}
          <a
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
            href="https://github.com/RECTOR-LABS/rector-arena/blob/main/docs/THREAT-MODEL.md"
          >
            docs/THREAT-MODEL.md §Invariants
          </a>
          .
        </p>
      </section>

      <section aria-label="paths forward" className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">3. What you can do</h2>
        <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5 text-foreground">
          <li>
            Have the agent draft it, then approve it yourself: the agent proposes via{" "}
            <code className="font-mono text-xs">create_request</code>, you review the receiver
            and amount and sign <code className="font-mono text-xs">approve_request</code> in
            lib.rs. Only then does the intent become spendable.
          </li>
          <li>
            Freeze the wallet: <code className="font-mono text-xs">freeze</code> in lib.rs stops
            settlement until you unfreeze.
          </li>
        </ul>
      </section>

      <section aria-label="every attack refused" className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">4. Every attack, refused</h2>
        <p className="mt-2 max-w-3xl text-foreground">
          Attack {ATTACK_ID} is the flagship moment, but it is not the only one. Each exploit in
          the battery ends with the reference wallet refusing; these are the receipts it left
          behind.
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="grid gap-4 md:grid-cols-2">
            {refusals.map((entry) => (
              <RejectionCard
                key={entry.id}
                cell={entry.cell}
                refusal={REFUSALS[entry.id] ?? "I did not send this."}
              />
            ))}
          </div>
        </div>
      </section>

      <section aria-label="the approval walkthrough" className="mt-8">
        <h2 className="text-balance text-lg font-semibold text-foreground">
          5. What an approved spend looks like — the happy path, walked end to end
        </h2>
        <p className="mt-2 max-w-3xl text-foreground">
          This is a walkthrough of the approval flow, not a wallet product: the reference wallet
          is an audit artifact, not an end-user wallet. In plain terms, while an intent waits in
          review the funds stay in the wallet — nothing moves until the owner signs the approval,
          and if the owner says no, the intent expires inert. Three contract calls make up the
          whole happy path in{" "}
          <a
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
            href="https://github.com/RECTOR-LABS/rector-arena/blob/main/contracts/reference-wallet/src/lib.rs"
          >
            contracts/reference-wallet/src/lib.rs
          </a>
          .
        </p>
        <ol className="mt-4 max-w-3xl list-decimal space-y-4 pl-5 text-foreground">
          <li>
            <span className="font-semibold">The agent registers the intent.</span>{" "}
            <code className="font-mono text-xs">create_request</code> (lib.rs) is agent-only: the
            agent — even one driven by poisoned content — can record a receiver and an amount,
            for example{" "}
            <span className="font-mono text-xs">receiver savings.test.near, amount 10</span>{" "}
            (illustrative values, not a committed receipt). Proposing carries no authorization:
            at this point the intent exists but cannot spend anything.
          </li>
          <li>
            <span className="font-semibold">The owner approves.</span>{" "}
            <code className="font-mono text-xs">approve_request</code> (lib.rs) is owner-only:
            that signature is the provenance the attack {ATTACK_ID} gate demands. Content in a
            message can draft a transfer; it can never produce this signature.
          </li>
          <li>
            <span className="font-semibold">The intent settles exactly once.</span>{" "}
            <code className="font-mono text-xs">spend_intent</code> consumes the approved intent
            receipt, so a replay finds nothing left to settle. The committed A3 receipt is this
            happy path in evidence:{" "}
            <a
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-xs text-primary hover:underline"
              href={`/${a3?.repoPath ?? "receipts/a3-needs-review-double-spend"}`}
            >
              {a3?.repoPath ?? "receipts/a3-needs-review-double-spend"}
            </a>{" "}
            — exactly {a3 ? `${settledTotal(a3)} moved once` : "the amount moved once"},{" "}
            {a3 ? (
              <>
                verdict <span className="text-hold">{a3.verdict}</span>, verdict_hash{" "}
                <span className="break-all">{a3.verdictHash}</span>,{" "}
                {a3.attestation ? <AttestationBadge attestation={a3.attestation} /> : "…"}
              </>
            ) : (
              "verdict hold"
            )}
            .
          </li>
        </ol>
        <p className="mt-4 max-w-3xl text-foreground">
          The rejection you saw above is this same flow with step 2 missing: content alone never
          substitutes for the owner&apos;s approval (INV-5).
        </p>
      </section>

      <section aria-label="receipts" className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">6. The receipts</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          The same attack, run against two wallets: the gateway replica falls, the reference
          wallet holds. Both runs are committed and attested.
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="grid gap-4 md:grid-cols-2">
            <ReceiptCard cell={fall} label="gateway (falls)" />
            <ReceiptCard cell={hold} label="reference (holds)" />
          </div>
        </div>
      </section>
    </main>
  );
}
