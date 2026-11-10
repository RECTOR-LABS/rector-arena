import Link from "next/link";

import VerdictSequencer, { type SequencerRow } from "@/app/components/verdict-sequencer";
import { Button } from "@/components/ui/button";
import { getAttestation } from "@/lib/attest";
import { loadAttackRows, settledTotal, type ReceiptCell } from "@/lib/receipts";

export const dynamic = "force-dynamic";

function toPlainCell(cell: ReceiptCell | null): SequencerRow["gateway"] {
  if (!cell) return null;
  return {
    settled: settledTotal(cell),
    verdict: cell.verdict,
    attestation: cell.attestation?.state ?? null,
  };
}

export default async function LandingPage() {
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

  const plainRows: SequencerRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    gateway: toPlainCell(row.cells.gateway),
    reference: toPlainCell(row.cells.reference),
  }));

  const allAttested = plainRows.every(
    (row) => row.gateway?.attestation === "match" && row.reference?.attestation === "match",
  );

  return (
    <main className="py-12">
      <section className="pt-4">
        <h1 className="font-display text-5xl text-foreground sm:text-6xl">
          Damn Vulnerable Agent Wallets
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-foreground">
          An open arena that hunts agent-wallet policy engines on NEAR.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button render={<Link href="/battery" />} nativeButton={false}>
            Run the battery
          </Button>
          <Button variant="outline" render={<Link href="/simulate" />} nativeButton={false}>
            Watch it fall and hold
          </Button>
          <Button variant="outline" render={<Link href="/wallet-says-no" />} nativeButton={false}>
            See the wallet say no
          </Button>
        </div>
      </section>

      <VerdictSequencer rows={plainRows} />

      <p className="mt-8 text-sm text-muted-foreground">
        {plainRows.length * 2} receipts,{" "}
        {allAttested ? (
          <>
            every verdict hash attested on attest-ledger.testnet,{" "}
            <Link className="text-primary hover:underline" href="/verify">
              recompute them yourself
            </Link>
            .
          </>
        ) : (
          <>
            live attestation view degraded right now, per-cell states on the{" "}
            <Link className="text-primary hover:underline" href="/leaderboard">
              leaderboard
            </Link>
            .
          </>
        )}
      </p>

      <section aria-label="what the reference wallet enforces" className="mt-56 max-w-2xl">
        <p className="text-foreground">
          Spends only pay owner-allowlisted receivers, capped per request and velocity-capped in
          total; the full spec lives in{" "}
          <a
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
            href="https://github.com/RECTOR-LABS/rector-arena/blob/main/contracts/reference-wallet/src/lib.rs#L507"
          >
            get_policy
          </a>
          .
        </p>
      </section>
    </main>
  );
}
