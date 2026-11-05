"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

const CAP = 100;
const SPEND = 20;
// The reference serializes check-and-decrement in-contract, so exactly five of
// the racing spends land before the cap rejects the rest.
const REFERENCE_LANDED = 5;
const ROW_STEP_MS = 300;

/**
 * Reduced-motion floor for the sims: false on the server and before mount so
 * hydration matches, then tracks the OS setting live.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** Real verdict hash plus the receipt file that carries it, as props from the page. */
export function ReceiptEvidence({
  label,
  hash,
  receipt,
}: {
  label: string;
  hash: string;
  receipt: string;
}) {
  if (!hash || !receipt) {
    return <p className="text-xs text-muted-foreground">{label}: receipt missing from this checkout</p>;
  }
  return (
    <div>
      <p className="font-mono text-xs break-all text-muted-foreground">
        {label}: {hash}
      </p>
      <Link
        href={`/${receipt}`}
        className="text-xs break-all text-primary hover:underline"
      >
        {receipt}
      </Link>
    </div>
  );
}

export default function CapRaceSim({
  gatewayHash,
  referenceHash,
  gatewayReceipt,
  referenceReceipt,
}: {
  gatewayHash: string;
  referenceHash: string;
  gatewayReceipt: string;
  referenceReceipt: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(1);
  const [shown, setShown] = useState(0);
  const [pageVisible, setPageVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // N change resets the ledger; reduced motion renders the final state at once.
  useEffect(() => {
    setShown(reduced ? n : 0);
  }, [n, reduced]);

  // Walk the rows in one timer at a time; cleanup clears the pending timer on
  // N change, on the browser tab hiding, and on unmount.
  useEffect(() => {
    if (reduced || !pageVisible || shown >= n) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setShown((value) => Math.min(value + 1, n));
    }, ROW_STEP_MS);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [n, pageVisible, reduced, shown]);

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const landed = Math.min(n, REFERENCE_LANDED);
  const referenceTotal = Math.min(n * SPEND, CAP);
  const gatewayFalls = n * SPEND > CAP;
  const rowsShown = Math.min(shown, n);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cap race (A1)</CardTitle>
        <CardDescription>
          Eight concurrent spends of 20 race a velocity cap of 100. The gateway reads its
          spent counter before any transfer resolves, the reference serializes
          check-and-decrement in-contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <style>{`
          @keyframes sim-row-in {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: none; }
          }
          .sim-row { animation: sim-row-in 250ms ease-out both; }
        `}</style>

        <div>
          <p className="text-sm text-foreground">concurrent spends: {n}</p>
          <Slider
            aria-label="concurrent spends"
            className="mt-2 max-w-md"
            min={1}
            max={8}
            step={1}
            value={[n]}
            onValueChange={(value) => setN(Array.isArray(value) ? value[0] : value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">gateway</h3>
              <Badge variant="outline" className={gatewayFalls ? "text-fall" : "text-hold"}>
                {gatewayFalls ? "fall" : "hold"}
              </Badge>
            </div>
            <ul className="mt-3 min-h-48 space-y-1">
              {Array.from({ length: rowsShown }, (_, index) => {
                const spend = index + 1;
                return (
                  <li key={spend} className="sim-row flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      spend {spend}: {SPEND}
                    </span>
                    <span className="text-hold">settled</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-sm text-foreground">
              {n * SPEND} of {CAP} cap
            </p>
          </div>

          <div className="bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">reference</h3>
              <Badge variant="outline" className="text-hold">
                hold
              </Badge>
            </div>
            <ul className="mt-3 min-h-48 space-y-1">
              {Array.from({ length: rowsShown }, (_, index) => {
                const spend = index + 1;
                const aborted = spend > REFERENCE_LANDED;
                return (
                  <li key={spend} className="sim-row flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      spend {spend}: {SPEND}
                    </span>
                    {aborted ? (
                      <span className="text-fall">aborted cap-exceeded</span>
                    ) : (
                      <span className="text-hold">settled</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-sm text-foreground">
              {referenceTotal} settled, {n - landed} aborted
            </p>
          </div>
        </div>

        <div className="bg-surface p-4">
          <p className="text-sm text-foreground">
            The committed run at N=8: gateway 160 fall, reference 100 hold.
          </p>
          <div className="mt-3 space-y-3">
            <ReceiptEvidence label="gateway" hash={gatewayHash} receipt={gatewayReceipt} />
            <ReceiptEvidence label="reference" hash={referenceHash} receipt={referenceReceipt} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
