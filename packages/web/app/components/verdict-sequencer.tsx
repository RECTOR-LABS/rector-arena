"use client";

import { useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";

export type SequencerCell = {
  settled: string;
  verdict: string;
  attestation: string | null;
} | null;

export type SequencerRow = {
  id: string;
  name: string;
  gateway: SequencerCell;
  reference: SequencerCell;
};

const VERDICT_CLASS: Record<string, string> = {
  hold: "text-hold",
  fall: "text-fall",
};

const ATTESTATION_BADGE: Record<string, { label: string; className: string }> = {
  match: { label: "attested", className: "text-hold" },
  mismatch: { label: "MISMATCH", className: "text-fall" },
  unattested: { label: "unattested", className: "text-muted-foreground" },
  "rpc-unreachable": { label: "rpc unreachable", className: "text-muted-foreground" },
};

const GRID =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] items-start gap-x-4";

function VerdictCell({ cell }: { cell: SequencerCell }) {
  if (!cell) {
    return <div role="cell" className="text-muted-foreground">no receipt</div>;
  }
  return (
    <div role="cell">
      <div>
        <span className={`font-semibold ${VERDICT_CLASS[cell.verdict] ?? "text-foreground"}`}>
          {cell.verdict}
        </span>{" "}
        <span className="text-muted-foreground">{cell.settled}</span>
      </div>
    </div>
  );
}

function AttestationCell({ cell }: { cell: SequencerCell }) {
  if (!cell || !cell.attestation) {
    return <span className="text-muted-foreground">…</span>;
  }
  const badge = ATTESTATION_BADGE[cell.attestation];
  if (!badge) {
    return <span className="text-muted-foreground">…</span>;
  }
  return <span className={badge.className}>{badge.label}</span>;
}

export default function VerdictSequencer({ rows }: { rows: SequencerRow[] }) {
  const [replays, setReplays] = useState(0);

  return (
    <section aria-label="verdict sequencer" className="mt-8">
      <div className="border border-border bg-card p-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setReplays((n) => n + 1)}>
            Replay
          </Button>
        </div>
        <div role="table" aria-label="attack verdicts" className="mt-1">
          <div role="row" className={`${GRID} pb-2 text-xs text-muted-foreground`}>
            <span role="columnheader">attack</span>
            <span role="columnheader">gateway</span>
            <span role="columnheader">reference</span>
            <span role="columnheader">attestation</span>
          </div>
          <div role="rowgroup" key={replays}>
            {rows.map((row, index) => (
              <div
                key={row.id}
                role="row"
                className={`seq-row ${GRID} border-t border-border py-3`}
                style={{ "--seq-i": index } as CSSProperties}
              >
                <div role="cell">
                  <span className="font-semibold text-foreground">{row.id}</span>{" "}
                  <span className="text-muted-foreground">{row.name}</span>
                </div>
                <VerdictCell cell={row.gateway} />
                <VerdictCell cell={row.reference} />
                <div role="cell" className="pt-0.5">
                  <AttestationCell cell={row.reference} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
