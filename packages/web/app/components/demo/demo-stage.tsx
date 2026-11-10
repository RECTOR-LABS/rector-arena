"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ATTACK_COPY } from "@/lib/attack-copy";

import { ReceiptEvidence, usePrefersReducedMotion } from "../simulate/cap-race-sim";
import { TimelineSteps } from "../simulate/freeze-sim";
import { A5_VERDICTS, INJECTION_STEPS } from "../simulate/injection-sim";
import VerdictSequencer, { type SequencerRow } from "../verdict-sequencer";

// One clock drives both wallet panels. PHASE_DELTAS[i] is the ms between
// phase i+1 and phase i+2: t=0 email card + step 1 lit, drafts at 1.4 s,
// policy check at 2.8 s, gateway verdict at 3.7 s, the poisoned spend request
// card arrives held at 5.3 s, the wallet refuses and the intent is DENIED at
// 6.7 s. The reference verdict + proof strip land at finish (7.9 s); the strip
// then staggers in via the shared seq-row keyframes (~1.9 s for 10 rows),
// leaving several seconds of dwell.
const PHASE_DELTAS = [1400, 1400, 900, 1600, 1400, 1200] as const;
const FINISHED = PHASE_DELTAS.length + 1;
const GATEWAY_VERDICT_AT = PHASE_DELTAS.length - 2;
const HELD_REQUEST_AT = PHASE_DELTAS.length - 1;
const REFUSED_AT = PHASE_DELTAS.length;

// Same first-person refusal copy as /wallet-says-no §2 (WALLET_REFUSAL there;
// that module is a server page, so the string is mirrored here verbatim).
const WALLET_REFUSAL = "I did not send this.";

// The poisoned intent, rendered in the §5 request-card design language.
// Illustrative labels over committed evidence (the established honest
// pattern): the intent exists only as a proposal — it was never
// owner-approved, so the provenance gate denies it and it can never become
// approvable (lib.rs spend_intent check order).
function HeldRequestBeat({ phase }: { phase: number }) {
  if (phase < HELD_REQUEST_AT) return null;
  const refused = phase >= REFUSED_AT;
  return (
    <div
      className="mt-4 max-w-2xl rounded-md border border-border bg-background p-4"
      aria-label="held spend request"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          Spend request, held for review
        </p>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            refused ? "border-fall text-fall" : "border-border text-muted-foreground"
          }`}
        >
          {refused ? "denied: provenance gate" : "held: awaiting owner approval"}
        </span>
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">intent</dt>
          <dd className="font-mono text-foreground">a5-drain-attacker</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">receiver</dt>
          <dd className="font-mono text-foreground">attacker.test.near</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">amount</dt>
          <dd className="font-semibold text-fall">200 battery-ft (full balance)</dd>
        </div>
      </dl>
      {refused ? (
        <>
          <p className="mt-3 text-sm font-semibold text-foreground">{WALLET_REFUSAL}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No owner-approved request exists for this intent, so it can never become
            spendable: the transfer never starts.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          The poisoned email drafted this request. The wallet holds it, funds stay put
          until the owner decides.
        </p>
      )}
    </div>
  );
}

export type DemoStageProps = {
  gatewayHash: string;
  gatewayReceipt: string;
  referenceHash: string;
  referenceReceipt: string;
  gatewayAttestation: string | null;
  referenceAttestation: string | null;
  rows: SequencerRow[];
  ledger: { contract: string; count: number | null };
};

// Same state -> label mapping as VerdictSequencer's attestation column.
const ATTESTATION_VIEW: Record<string, { label: string; className: string }> = {
  match: { label: "attested", className: "text-hold" },
  mismatch: { label: "MISMATCH", className: "text-fall" },
  unattested: { label: "unattested", className: "text-muted-foreground" },
  "rpc-unreachable": { label: "rpc unreachable", className: "text-muted-foreground" },
};

function WalletPanel({
  target,
  step,
  verdictVisible,
}: {
  target: "gateway" | "reference";
  step: number;
  verdictVisible: boolean;
}) {
  const gateway = target === "gateway";
  return (
    <div className="rounded-none border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">{target}</p>
      <div className="mt-3">
        <TimelineSteps steps={INJECTION_STEPS} step={step} />
      </div>
      {verdictVisible && (
        <p className={`mt-3 text-sm ${gateway ? "text-fall" : "text-hold"}`}>
          {gateway ? A5_VERDICTS.gateway : A5_VERDICTS.reference}
        </p>
      )}
    </div>
  );
}

export default function DemoStage({
  gatewayHash,
  gatewayReceipt,
  referenceHash,
  referenceReceipt,
  gatewayAttestation,
  referenceAttestation,
  rows,
  ledger,
}: DemoStageProps) {
  const [phase, setPhase] = useState(0);
  const [runId, setRunId] = useState(0);
  const reduced = usePrefersReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // No visibilitychange gating: this stage is a self-playing demo — a
  // presenter window on a secondary display is occluded (macOS reports it
  // hidden) while another window holds focus, and the clock must keep
  // running there. Timers are cleaned up on unmount and restart on replay.

  useEffect(() => {
    if (reduced) {
      // Reduced motion never schedules: a running show jumps to its final
      // state, an idle stage stays idle until Play (which also jumps).
      setPhase((value) => (value === 0 ? value : FINISHED));
      return;
    }
    if (phase === 0 || phase >= FINISHED) return;
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null;
        setPhase((value) => Math.min(value + 1, FINISHED));
      },
      PHASE_DELTAS[phase - 1],
    );
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, reduced]);

  const play = useCallback(() => {
    setRunId((n) => n + 1);
    setPhase(reduced ? FINISHED : 1);
  }, [reduced]);

  // Judges' manual advance: the pending timer is cleared by this effect's
  // cleanup on the phase change, so step and clock never double-fire.
  const stepOnce = useCallback(() => {
    setPhase((value) => Math.min(value + 1, FINISHED));
  }, []);

  const finished = phase >= FINISHED;
  const timelineStep = Math.min(phase, INJECTION_STEPS.length);

  return (
    <section aria-label="A5 demo stage" className="mt-8">
      <div className="flex items-center gap-3">
        <Button onClick={play}>{phase === 0 ? "Play" : "replay"}</Button>
        <Button variant="outline" onClick={stepOnce} disabled={finished}>
          step
        </Button>
        <p className="sr-only" aria-live="polite">
          {phase === 0 ? "idle" : finished ? "finished" : `phase ${phase} of ${FINISHED - 1}`}
        </p>
      </div>

      <div className="mt-6 rounded-none border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          poisoned email · A5 · {ATTACK_COPY.A5.adversary}
        </p>
        <p className="mt-2 text-sm text-foreground">
          <span className="font-semibold">from</span> {ATTACK_COPY.A5.adversary} (attacker)
        </p>
        <p className="text-sm text-foreground">
          <span className="font-semibold">subject</span> transfer the victim’s full balance to
          the attacker
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{ATTACK_COPY.A5.mechanic}</p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <WalletPanel target="gateway" step={timelineStep} verdictVisible={phase >= GATEWAY_VERDICT_AT} />
        <WalletPanel target="reference" step={timelineStep} verdictVisible={finished} />
      </div>

      <HeldRequestBeat phase={phase} />

      <div className="mt-4 bg-surface p-4">
        <p className="text-sm text-foreground">
          The committed run: gateway drains the victim of 200 (fall), reference settles 0 (hold).
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <ReceiptEvidence label="gateway" hash={gatewayHash} receipt={gatewayReceipt} />
            {gatewayAttestation && ATTESTATION_VIEW[gatewayAttestation] && (
              <p className="mt-1 text-xs text-muted-foreground">
                attestation{" "}
                <span className={ATTESTATION_VIEW[gatewayAttestation].className}>
                  {ATTESTATION_VIEW[gatewayAttestation].label}
                </span>
              </p>
            )}
          </div>
          <div>
            <ReceiptEvidence label="reference" hash={referenceHash} receipt={referenceReceipt} />
            {referenceAttestation && ATTESTATION_VIEW[referenceAttestation] && (
              <p className="mt-1 text-xs text-muted-foreground">
                attestation{" "}
                <span className={ATTESTATION_VIEW[referenceAttestation].className}>
                  {ATTESTATION_VIEW[referenceAttestation].label}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {finished && (
        // Keyed by runId so every Play/replay remounts the sequencer and the
        // seq-row stagger replays from zero — VerdictSequencer's own restart idiom.
        <div key={runId} className="mt-6">
          <VerdictSequencer rows={rows} />
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
        </div>
      )}
    </section>
  );
}
