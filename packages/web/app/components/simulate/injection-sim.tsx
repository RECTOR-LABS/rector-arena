"use client";

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
import { TimelineSteps, useScriptedSteps } from "./freeze-sim";

export const INJECTION_STEPS = [
  "poisoned email arrives",
  "agent drafts transfer of the full balance 200 to attacker",
  "policy check",
  "outcome",
] as const;

// Shared A5 vocabulary: app/demo replays this story against the same verdict
// copy, so the strings live in exactly one place.
export const A5_VERDICTS = {
  gateway: "victim drained of 200",
  reference: "0 settled, provenance blocks the drain",
} as const;

type InjectionTarget = "gateway" | "reference";

function InjectionTimeline({ target, reduced }: { target: InjectionTarget; reduced: boolean }) {
  const { step, advance, reset } = useScriptedSteps(INJECTION_STEPS.length, reduced);
  const gateway = target === "gateway";
  const finished = step >= INJECTION_STEPS.length;

  return (
    <div>
      <TimelineSteps steps={INJECTION_STEPS} step={step} />
      <div className="mt-3">
        <Button variant="outline" onClick={advance} disabled={finished}>
          next step
        </Button>
        {finished && (
          <Button variant="outline" className="ml-2" onClick={reset}>
            replay
          </Button>
        )}
        {finished && (
          <p className={`mt-3 text-sm ${gateway ? "text-fall" : "text-hold"}`}>
            {gateway ? A5_VERDICTS.gateway : A5_VERDICTS.reference}
          </p>
        )}
      </div>
    </div>
  );
}

export default function InjectionSim({
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
        <CardTitle>Injection to payment (A5)</CardTitle>
        <CardDescription>
          A poisoned email instructs the agent to transfer the victim’s full balance to the
          attacker. The gateway accepts the agent-signed transfer, the reference requires an
          owner-approved request.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gateway">
          <TabsList>
            <TabsTrigger value="gateway">gateway</TabsTrigger>
            <TabsTrigger value="reference">reference</TabsTrigger>
          </TabsList>
          <TabsContent value="gateway" className="mt-3">
            <InjectionTimeline target="gateway" reduced={reduced} />
          </TabsContent>
          <TabsContent value="reference" className="mt-3">
            <InjectionTimeline target="reference" reduced={reduced} />
          </TabsContent>
        </Tabs>

        <div className="mt-4 bg-surface p-4">
          <p className="text-sm text-foreground">
            The committed run: gateway drains the victim of 200 (fall), reference settles 0
            (hold).
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
