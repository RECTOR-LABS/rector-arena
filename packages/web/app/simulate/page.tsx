import Link from "next/link";

import CapRaceSim from "@/app/components/simulate/cap-race-sim";
import FreezeSim from "@/app/components/simulate/freeze-sim";
import InjectionSim from "@/app/components/simulate/injection-sim";
import { loadAttackRows, type AttackRow } from "@/lib/receipts";

export const dynamic = "force-dynamic";

type Evidence = { hash: string; receipt: string };

function evidenceOf(
  rows: AttackRow[],
  attackId: string,
  target: "gateway" | "reference",
): Evidence {
  const cell = rows.find((row) => row.id === attackId)?.cells[target];
  if (!cell) return { hash: "", receipt: "" };
  return { hash: cell.verdictHash, receipt: cell.repoPath };
}

export default async function SimulatePage() {
  const rows = await loadAttackRows();

  const a1Gateway = evidenceOf(rows, "A1", "gateway");
  const a1Reference = evidenceOf(rows, "A1", "reference");
  const a2Gateway = evidenceOf(rows, "A2", "gateway");
  const a2Reference = evidenceOf(rows, "A2", "reference");
  const a5Gateway = evidenceOf(rows, "A5", "gateway");
  const a5Reference = evidenceOf(rows, "A5", "reference");

  return (
    <main className="py-12">
      <header>
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">Simulate</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
        Client-side replay of the committed battery parameters. The real run is the sandbox
        harness, reproduce it with{" "}
        <Link href="/battery" className="text-primary hover:underline">
          pnpm arena:run
        </Link>
        .
      </p>
      </header>

      <h2 className="mt-10 font-display text-3xl text-foreground md:text-5xl">Replay an attack</h2>
      <section aria-label="simulations" className="mt-6 space-y-8">
        <CapRaceSim
          gatewayHash={a1Gateway.hash}
          referenceHash={a1Reference.hash}
          gatewayReceipt={a1Gateway.receipt}
          referenceReceipt={a1Reference.receipt}
        />
        <FreezeSim
          gatewayHash={a2Gateway.hash}
          referenceHash={a2Reference.hash}
          gatewayReceipt={a2Gateway.receipt}
          referenceReceipt={a2Reference.receipt}
        />
        <InjectionSim
          gatewayHash={a5Gateway.hash}
          referenceHash={a5Reference.hash}
          gatewayReceipt={a5Gateway.receipt}
          referenceReceipt={a5Reference.receipt}
        />
      </section>
    </main>
  );
}
