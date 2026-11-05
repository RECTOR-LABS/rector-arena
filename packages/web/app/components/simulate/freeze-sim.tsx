"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ReceiptEvidence, usePrefersReducedMotion } from "./cap-race-sim";

const FREEZE_STEPS = [
  "commitment 25 registered",
  "wallet frozen",
  "trigger fires",
  "settle attempt",
] as const;
const STEP_MS = 900;

type FreezeTarget = "gateway" | "reference";

/**
 * Shared scripted-timeline state: auto-advances every STEP_MS, a manual advance
 * reschedules, and the effect cleanup clears the pending timer on unmount (tab
 * panels unmount on tab switch, so a switch stops the clock too). Reduced
 * motion jumps straight to the last step and never schedules.
 */
export function useScriptedSteps(stepCount: number, reducedMotion: boolean) {
  const [step, setStep] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setStep(stepCount);
      return;
    }
    if (step >= stepCount) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setStep((value) => Math.min(value + 1, stepCount));
    }, STEP_MS);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [reducedMotion, step, stepCount]);

  const advance = useCallback(() => {
    setStep((value) => Math.min(value + 1, stepCount));
  }, [stepCount]);

  return { step, advance };
}

function TimelineSteps({
  steps,
  step,
}: {
  steps: readonly string[];
  step: number;
}) {
  return (
    <ol className="space-y-1.5 text-sm">
      {steps.map((label, index) => {
        const position = index + 1;
        const reached = position <= step;
        return (
          <li key={label} className={reached ? "text-foreground" : "text-muted-foreground"}>
            {position}. {label}
          </li>
        );
      })}
    </ol>
  );
}

function FreezeTimeline({ target, reduced }: { target: FreezeTarget; reduced: boolean }) {
  const { step, advance } = useScriptedSteps(FREEZE_STEPS.length, reduced);
  const gateway = target === "gateway";
  const finished = step >= FREEZE_STEPS.length;

  return (
    <div>
      <TimelineSteps steps={FREEZE_STEPS} step={step} />
      <div className="mt-3">
        <Button variant="outline" onClick={advance} disabled={finished}>
          next step
        </Button>
        {finished && (
          <p className={`mt-3 text-sm ${gateway ? "text-fall" : "text-hold"}`}>
            {gateway ? "25 settled post-freeze" : "0 settled post-freeze"}
          </p>
        )}
      </div>
    </div>
  );
}

export default function FreezeSim({
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Freeze bypass (A2)</CardTitle>
        <CardDescription>
          A commitment for 25 is registered, then the wallet is frozen. The gateway honors
          the resting order, the reference cancels outstanding commitments at freeze.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gateway">
          <TabsList>
            <TabsTrigger value="gateway">gateway</TabsTrigger>
            <TabsTrigger value="reference">reference</TabsTrigger>
          </TabsList>
          <TabsContent value="gateway" className="mt-3">
            <FreezeTimeline target="gateway" reduced={reduced} />
          </TabsContent>
          <TabsContent value="reference" className="mt-3">
            <FreezeTimeline target="reference" reduced={reduced} />
          </TabsContent>
        </Tabs>

        <div className="mt-4 bg-surface p-4">
          <p className="text-sm text-foreground">
            The committed run: gateway 25 settled post-freeze (fall), reference 0 (hold).
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
