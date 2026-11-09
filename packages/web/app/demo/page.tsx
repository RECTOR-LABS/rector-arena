import DemoStage from "@/app/components/demo/demo-stage";
import type { SequencerRow } from "@/app/components/verdict-sequencer";
import { getAttestation, getAttestationCount } from "@/lib/attest";
import { loadAttackRows, settledTotal, type ReceiptCell } from "@/lib/receipts";

export const dynamic = "force-dynamic";

// Same receipt -> sequencer-cell mapping as app/page.tsx.
function toPlainCell(cell: ReceiptCell | null): SequencerRow["gateway"] {
  if (!cell) return null;
  return {
    settled: settledTotal(cell),
    verdict: cell.verdict,
    attestation: cell.attestation?.state ?? null,
  };
}

export default async function DemoPage() {
  const ledgerPromise = getAttestationCount();
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
  const ledger = await ledgerPromise;

  const plainRows: SequencerRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    gateway: toPlainCell(row.cells.gateway),
    reference: toPlainCell(row.cells.reference),
  }));

  const a5 = rows.find((row) => row.id === "A5");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header>
        <h1 className="font-display text-4xl">rector-arena: demo</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          One Play button replays attack A5: poisoned email, dual wallets, verdicts, then the
          full receipt strip with its live attestation states.
        </p>
      </header>
      <DemoStage
        gatewayHash={a5?.cells.gateway?.verdictHash ?? ""}
        gatewayReceipt={a5?.cells.gateway?.repoPath ?? ""}
        referenceHash={a5?.cells.reference?.verdictHash ?? ""}
        referenceReceipt={a5?.cells.reference?.repoPath ?? ""}
        gatewayAttestation={a5?.cells.gateway?.attestation?.state ?? null}
        referenceAttestation={a5?.cells.reference?.attestation?.state ?? null}
        rows={plainRows}
        ledger={ledger}
      />
    </main>
  );
}
