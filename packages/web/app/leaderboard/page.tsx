import Link from "next/link";

import { getAttestation, getAttestationCount, type AttestationState } from "@/lib/attest";
import { humanizeDelta, loadAttackRows, settledTotal, type AttackRow, type ReceiptCell } from "@/lib/receipts";

export const dynamic = "force-dynamic";

const VERDICT_STYLES: Record<string, string> = {
  hold: "text-hold",
  fall: "text-fall",
};

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

function VerdictCell({ cell }: { cell: ReceiptCell | null }) {
  if (!cell) {
    return <td className="border-t border-border px-3 py-3 text-muted-foreground">no receipt</td>;
  }
  return (
    <td className="border-t border-border px-3 py-3 align-top">
      <div>
        <span className={`font-semibold ${VERDICT_STYLES[cell.verdict] ?? "text-foreground"}`}>
          {cell.verdict}
        </span>
        <span className="text-muted-foreground">
          , {settledTotal(cell)} settled
        </span>
      </div>
      <div className="mt-1">
        <a
          className="break-all font-mono text-xs text-primary hover:underline"
          href={`/${cell.repoPath}`}
        >
          {cell.repoPath}
        </a>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        ran_at {cell.ranAt}, integrity <IntegrityBadge ok={cell.integrityOk} />,{" "}
        {cell.attestation ? <AttestationBadge attestation={cell.attestation} /> : "…"}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {cell.perAccountDeltas.map((d) => (
          <div key={`${d.account}-${d.token}`}>
            {d.account}: {humanizeDelta(d.delta)} {d.token}
          </div>
        ))}
      </div>
    </td>
  );
}

function AttackRowView({ row }: { row: AttackRow }) {
  return (
    <tr>
      <td className="border-t border-border px-3 py-3 align-top">
        <span className="font-mono font-semibold text-foreground">{row.id}</span>{" "}
        <span className="text-foreground">{row.name}</span>
      </td>
      <VerdictCell cell={row.cells.gateway} />
      <VerdictCell cell={row.cells.reference} />
    </tr>
  );
}

export default async function LeaderboardPage() {
  const rows = await loadAttackRows();
  const ledger = await getAttestationCount();
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
      <h1 className="text-2xl font-bold text-foreground">rector-arena: leaderboard</h1>
      <p className="mt-2 max-w-4xl text-foreground">
        Damn Vulnerable Agent Wallets, an open arena that hunts agent-wallet policy engines on
        NEAR, and ships the wallet that survives.{" "}
        <Link className="text-primary hover:underline" href="https://github.com/RECTOR-LABS/rector-arena#readme">
          README
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        attestation ledger:{" "}
        {ledger.count === null ? (
          <span className="text-muted-foreground">unreachable</span>
        ) : (
          <span className="text-foreground">
            {ledger.count} attestation{ledger.count === 1 ? "" : "s"} @{" "}
            <span className="font-mono">{ledger.contract}</span>
          </span>
        )}
      </p>

      <table className="mt-6 w-full border-collapse text-sm">
        <caption className="sr-only">
          Attack battery results: gateway vs reference verdicts with attestation state
        </caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">
              attack
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              gateway
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              reference
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AttackRowView key={row.id} row={row} />
          ))}
        </tbody>
      </table>

      <p className="mt-6 max-w-4xl text-xs text-muted-foreground">
        Attestation states, attested: on-chain verdict_hash equals the receipt&apos;s; MISMATCH:
        on-chain verdict_hash differs; unattested: no attestation recorded for this attack/target;
        rpc unreachable: the testnet RPC could not be queried. Integrity: each receipt&apos;s
        verdict_hash is recomputed from {"{"}attack_id, target, verdict, per_account_deltas{"}"} and
        compared against the hash stored in the file. Architecture:{" "}
        <Link className="text-primary hover:underline" href="https://github.com/RECTOR-LABS/rector-arena/blob/main/docs/ARCHITECTURE.md">
          docs/ARCHITECTURE.md
        </Link>
      </p>
    </main>
  );
}
