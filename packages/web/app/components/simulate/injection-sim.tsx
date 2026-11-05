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
import { useScriptedSteps } from "./freeze-sim";

const INJECTION_STEPS = [
  "poisoned email arrives",
  "agent drafts transfer of the full balance 200 to attacker",
  "policy check",
  "outcome",
] as const;

type InjectionTarget = "gateway" | "reference";

function InjectionTimeline({ target, reduced }: { target: InjectionTarget; reduced: boolean }) {
  const { step, advance } = useScriptedSteps(INJECTION_STEPS.length, reduced);
  const gateway = target === "gateway";
  const finished = step >= INJECTION_STEPS.length;

  return (
    <div>
      <ol className="space-y-1.5 text-sm">
        {INJECTION_STEPS.map((label, index) => {
          const position = index + 1;
          const reached = position <= step;
          return (
            <li key={label} className={reached ? "text-foreground" : "text-muted-foreground"}>
              {position}. {label}
            </li>
          );
        })}
      </ol>
      <div className="mt-3">
        <Button variant="outline" onClick={advance} disabled={finished}>
          next step
        </Button>
        {finished && (
          <p className={`mt-3 text-sm ${gateway ? "text-fall" : "text-hold"}`}>
            {gateway ? "victim drained of 200" : "0 settled, provenance blocks the drain"}
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
