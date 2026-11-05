import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAttestation, type AttestationState } from "@/lib/attest";
import { ATTACK_COPY } from "@/lib/attack-copy";
import { loadAttackRows, type AttackRow, type ReceiptCell } from "@/lib/receipts";

export const dynamic = "force-dynamic";

const THREAT_MODEL_URL =
  "https://github.com/RECTOR-LABS/rector-arena/blob/main/docs/THREAT-MODEL.md#adversaries";

const ATTESTATION_VIEW: Record<AttestationState["state"], { label: string; className: string }> = {
  match: { label: "attested", className: "text-hold" },
  mismatch: { label: "MISMATCH", className: "text-fall" },
  unattested: { label: "unattested", className: "text-muted-foreground" },
  "rpc-unreachable": { label: "rpc unreachable", className: "text-muted-foreground" },
};

function AttestationBadge({ attestation }: { attestation: AttestationState }) {
  const view = ATTESTATION_VIEW[attestation.state];
  return <span className={view.className}>{view.label}</span>;
}

function VerdictCell({ cell, amount, amountClass }: { cell: ReceiptCell | null; amount: string; amountClass: string }) {
  if (!cell) {
    return (
      <div className="rounded-none border border-border bg-card p-4">
        <p className="text-sm font-semibold text-muted-foreground">no receipt</p>
      </div>
    );
  }
  return (
    <div className="rounded-none border border-border bg-card p-4">
      <p className="text-sm">
        <span className="font-semibold text-foreground">{cell.target}</span>{" "}
        <span className="text-muted-foreground">{cell.verdict}</span>
      </p>
      <p className={`mt-1 font-semibold ${amountClass}`}>{amount}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        attestation {cell.attestation ? <AttestationBadge attestation={cell.attestation} /> : "..."}
      </p>
      <Link
        className="mt-2 block break-all font-mono text-xs text-primary hover:underline"
        href={`/${cell.repoPath}`}
      >
        {cell.repoPath}
      </Link>
    </div>
  );
}

function AttackCard({ row }: { row: AttackRow }) {
  const copy = ATTACK_COPY[row.id];
  if (!copy) return null;
  return (
    <Card>
      <CardHeader>
        <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-2 font-heading text-base leading-snug font-medium">
          <span className="font-mono">{row.id}</span>
          <span>{copy.title}</span>
          <Badge variant="secondary">{copy.weakness}</Badge>
        </h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          adversary{" "}
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={THREAT_MODEL_URL}>
            {copy.adversary}
          </a>
        </p>
        <p className="leading-relaxed">{copy.mechanic}</p>
        <p className="leading-relaxed">oracle: {copy.oracle}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <VerdictCell cell={row.cells.gateway} amount={copy.fall} amountClass="text-fall" />
          <VerdictCell cell={row.cells.reference} amount={copy.hold} amountClass="text-hold" />
        </div>
        <p className="text-sm">
          <a
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
            href={`https://github.com/RECTOR-LABS/rector-arena/blob/main/docs/ATTACK-BATTERY.md#${copy.specAnchor}`}
          >
            spec
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

export default async function AttacksPage() {
  const rows = await loadAttackRows();
  await Promise.all(
    rows.flatMap((row) =>
      (["gateway", "reference"] as const).map(async (target) => {
        const cell = row.cells[target];
        if (!cell) return;
        cell.attestation = await getAttestation(cell.attackId, cell.target, cell.verdictHash);
      }),
    ),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header>
        <h1 className="font-display text-4xl">The attacks</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
        Five attacks, each with a fixed oracle, run against both targets on a mainnet fork. Verdict
        amounts below mirror the committed receipts.
      </p>
      </header>
      <h2 className="mt-10 font-display text-3xl text-foreground md:text-5xl">A1 through A5</h2>
      <section aria-label="attack cards" className="mt-6 space-y-6">
        {rows.map((row) => (
          <AttackCard key={row.id} row={row} />
        ))}
      </section>
    </main>
  );
}
