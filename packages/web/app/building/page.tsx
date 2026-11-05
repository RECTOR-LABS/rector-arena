import type { Metadata } from "next";
import Link from "next/link";

const GH = "https://github.com/RECTOR-LABS/rector-arena/blob/main";

function A({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
    </Link>
  );
}

function C({ children }: { children: React.ReactNode }) {
  return <code className="text-foreground">{children}</code>;
}

export const metadata: Metadata = {
  title: "rector-arena: Build on it",
  description:
    "Extend the arena: add a target, add an attack, and rely on FR-11 determinism.",
};

export default function BuildingPage() {
  return (
    <main className="py-10">

      <header>
        <h1 className="font-display text-4xl text-foreground">Build on it</h1>
        <p className="mt-4 text-foreground">
          The harness is a small TypeScript tree built for extension: one
          interface for targets, one directory of attack modules, one hash
          contract that keeps every run reproducible.
        </p>
      </header>

        <section className="max-w-3xl mt-10 border-t border-border pt-8">
          <h2 className="font-display text-3xl text-foreground md:text-5xl">Targets</h2>
          <p className="mt-4 text-foreground">
            The registry is one environment variable, read in{" "}
            <A href={`${GH}/packages/harness/src/run.ts`}>run.ts</A>.{" "}
            <C>ARENA_TARGET=gateway</C> or <C>ARENA_TARGET=reference</C> runs a
            single target. Unset, one command runs the full battery against
            both targets. An unknown value exits 2 before any account creation (
            <A href={`${GH}/packages/harness/src/run.ts#L20-L23`}>usageFail</A>
            ).
          </p>
          <p className="mt-4 text-foreground">
            A target implements the{" "}
            <A href={`${GH}/packages/harness/src/types.ts#L37`}>
              ArenaTarget interface
            </A>{" "}
            and boots through the{" "}
            <A href={`${GH}/packages/harness/src/run.ts#L31`}>bootTarget</A>{" "}
            factory, which selects{" "}
            <A href={`${GH}/packages/harness/src/targets/gateway.ts`}>
              GatewayTargetAdapter
            </A>{" "}
            (the adapter over the gateway-replica contract) or{" "}
            <A href={`${GH}/packages/harness/src/targets/reference.ts`}>
              ReferenceTarget
            </A>
            . A third target is three edits: implement the interface, extend the{" "}
            <C>TargetId</C> union, extend the selection in <C>bootTarget</C>.
          </p>
        </section>

        <section className="max-w-3xl mt-10 border-t border-border pt-8">
          <h2 className="font-display text-3xl text-foreground md:text-5xl">Attacks</h2>
          <p className="mt-4 text-foreground">
            An attack is a module in{" "}
            <A href="https://github.com/RECTOR-LABS/rector-arena/tree/main/packages/harness/src/attacks">
              src/attacks
            </A>{" "}
            exporting <C>runA1</C> through <C>runA5</C>. Constants live in{" "}
            <A href={`${GH}/packages/harness/src/config.ts`}>config.ts</A>:{" "}
            <A href={`${GH}/packages/harness/src/config.ts#L7`}>ONE_TOKEN</A>,{" "}
            the{" "}
            <A href={`${GH}/packages/harness/src/config.ts#L13`}>A1 block</A>{" "}
            (cap 100, spend 20, concurrency 8), and the receipt slugs such as{" "}
            <A href={`${GH}/packages/harness/src/config.ts#L85`}>A1_SLUG</A>.
          </p>
          <p className="mt-4 text-foreground">
            The runner writes each receipt with{" "}
            <A href={`${GH}/packages/harness/src/receipt.ts#L61`}>
              writeReceipt
            </A>{" "}
            and stamps the hash from{" "}
            <A href={`${GH}/packages/harness/src/receipt.ts#L28`}>
              verdictHash
            </A>
            , computed over the FR-11 canonical core: attack_id, target,
            verdict, per_account_deltas, in that order. Every run closes with
            the oracle check{" "}
            <A href={`${GH}/packages/harness/src/oracle.ts#L21`}>
              assertPolicyRecomputable
            </A>{" "}
            (W-5: policy state is recomputable from on-chain state alone).
          </p>
          <p className="mt-4 text-foreground">
            New attacks append as A6 and later, only through a{" "}
            <A href={`${GH}/PRD.md`}>PRD.md §0 amendment</A>: IDs are never
            renamed, reused, or renumbered.
          </p>
        </section>

        <section className="max-w-3xl mt-10 border-t border-border pt-8">
          <h2 className="font-display text-3xl text-foreground md:text-5xl">Determinism</h2>
          <p className="mt-4 text-foreground">
            FR-11 is the contract you extend against: the canonical core
            re-runs equal. The{" "}
            <A href={`${GH}/docs/ROADMAP.md#L30`}>M0 spike record</A> pinned the
            field set and reproduced hashes unchanged across sessions; the{" "}
            <A href={`${GH}/docs/ROADMAP.md#L76`}>M4 re-run</A> came out equal
            on both targets at fork height 222603395, later than the M0 pin at
            222518565, with the committed receipts unchanged.
          </p>
          <p className="mt-4 text-foreground">
            Runtime envelope, measured at M0: node startup 528 ms against a 120
            s budget, per-tx p95 2021 ms against a 5 s budget.
          </p>
        </section>

        <p className="max-w-3xl mt-10 border-t border-border pt-8 text-foreground">
          The{" "}
          <A href="https://github.com/RECTOR-LABS/rector-arena/tree/main/packages/harness/src">
            harness source tree
          </A>{" "}
          is the reference for everything above: registry, boot factory, attack
          modules, receipt writer, oracle.
        </p>

    </main>
  );
}
