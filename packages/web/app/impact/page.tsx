import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "rector-arena: Impact",
  description:
    "The documented agent-wallet custody gap, the five invariants that close it, and free verification for every verdict hash.",
};

const GITHUB = "https://github.com/RECTOR-LABS/rector-arena/blob/main";

const INVARIANTS = [
  { id: "INV-1", text: "Concurrency cannot settle beyond the committed velocity cap" },
  { id: "INV-2", text: "A freeze produces zero future settlement from prior authorizations" },
  { id: "INV-3", text: "Settlement is idempotent per intent id" },
  { id: "INV-4", text: "The function-call key cannot move value outside the policy forward" },
  { id: "INV-5", text: "No settlement originates outside the policy-approved request flow" },
];

export default function ImpactPage() {
  return (
    <div className="flex flex-col gap-10 py-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl text-foreground">Why this matters for NEAR</h1>
        <p className="mt-4 text-lg text-foreground">
          The impact is hardening rails for NEAR&apos;s agentic-economy push: every agent-wallet
          builder on NEAR can run the battery against their own design for free, then adopt the
          reference wallet&apos;s five invariants (INV-1..INV-5) as a checklist.{" "}
          <a
            className="text-primary hover:underline"
            href={`${GITHUB}/PRD.md#7-success-criteria--demo-script`}
          >
            PRD.md §7
          </a>
        </p>
      </header>

      <section className="border-t border-border pt-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">The documented gap</h2>
        <p className="mt-3 max-w-2xl text-foreground">
          Agent-wallet custody docs publish best-effort guardrail semantics, so builders inherit
          vague guarantees instead of tested ones. The concrete failure classes are documented in
          the partner&apos;s own words, quoted from the frozen snapshot (
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={`${GITHUB}/docs/quotes/outlayer-agent-custody.md`}>
            docs/quotes/outlayer-agent-custody.md
          </a>
          ):
        </p>
        <ul className="mt-3 max-w-2xl list-disc pl-5 text-foreground">
          <li>
            Concurrency: &quot;the cumulative caps may be exceeded by the in-flight batch&quot; (
            <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={`${GITHUB}/PRD.md#2-problem--why-now`}>
              PRD.md §2
            </a>
            ,{" "}
            <a
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
              href={`${GITHUB}/docs/quotes/outlayer-agent-custody.md`}
            >
              snapshot
            </a>
            )
          </li>
          <li>
            Freeze: &quot;freezing the wallet stops new orders but does not cancel resting ones&quot; (
            <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={`${GITHUB}/PRD.md#2-problem--why-now`}>
              PRD.md §2
            </a>
            ,{" "}
            <a
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
              href={`${GITHUB}/docs/quotes/outlayer-agent-custody.md`}
            >
              snapshot
            </a>
            )
          </li>
          <li>
            Ambiguous status: &quot;do not auto-retry (the transfer may have fired, so a retry can
            double-spend)&quot; (
            <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={`${GITHUB}/PRD.md#2-problem--why-now`}>
              PRD.md §2
            </a>
            ,{" "}
            <a
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
              href={`${GITHUB}/docs/quotes/outlayer-agent-custody.md`}
            >
              snapshot
            </a>
            )
          </li>
        </ul>
      </section>

      <section className="bg-surface -mx-4 px-4 py-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">The checklist</h2>
        <p className="mt-3 max-w-2xl text-foreground">
          Run the battery, then adopt the five invariants as a free design checklist for your own
          NEAR agent wallet (
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={`${GITHUB}/PRD.md#3-threat-model--invariants-constitution`}>
            PRD.md §3
          </a>
          ):
        </p>
        <ul className="mt-3 max-w-2xl list-disc pl-5 text-foreground">
          {INVARIANTS.map((inv) => (
            <li key={inv.id}>{inv.text}</li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Verifiability as a NEAR feature</h2>
        <p className="mt-3 max-w-2xl text-foreground">
          Every verdict hash is attested on NEAR testnet and explorer-verifiable (SC-3). The
          append-once tamper-evident ledger (same-hash re-attest idempotent, conflicting hash
          panics) is itself a reusable NEAR pattern for verifiable claims. See the contract (
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={`${GITHUB}/contracts/attest/src/lib.rs`}>
            contracts/attest/src/lib.rs
          </a>
          ) or{" "}
          <Link className="text-primary hover:underline" href="/verify">
            recompute the hashes yourself
          </Link>
          .
        </p>
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Free and open</h2>
        <p className="mt-3 max-w-2xl text-foreground">
          MIT licensed (
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={`${GITHUB}/LICENSE`}>LICENSE</a>
          ), one command (<code className="text-foreground">pnpm arena:run</code>), secret-free base
          run (FR-9, SC-1). No public harness proves policy-engine failure with settlement on a real
          fork: &quot;none publicly executes a financial exploit against the agent-wallet policy
          engine itself (spend caps, freezes, settlement receipts, function-call-key scoping) on a
          real NEAR fork, with settlement&quot; (
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={`${GITHUB}/docs/NOVELTY-POSITIONING.md`}>
            docs/NOVELTY-POSITIONING.md
          </a>
          ).
        </p>
      </section>
    </div>
  );
}
