import Link from "next/link";

import { CopyButton } from "@/app/components/copy-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const GITHUB = "https://github.com/RECTOR-LABS/rector-arena/blob/main";

const BUILD_OUTPUT = `packages/web build:   ✓ Generating static pages using 4 workers (2/2) in 125ms
packages/web build: Done
packages/harness build$ tsc -p . --noEmit
packages/harness build: Done`;

const RUN_OUTPUT = `fr11=equal
pair=a1:ok;a2:ok;a3:ok;a4:ok;a5:ok
w5=ok
sc2=ok
run_verdicts=ok
gate=PASS
receipts=10
full_battery_gate=PASS`;

export default function BatteryPage() {
  return (
    <div className="flex flex-col gap-10 py-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl text-foreground">Run the battery</h1>
        <p className="mt-4 text-lg text-foreground">
          One command, clean environment, no secrets. The full battery runs both targets and
          writes ten receipts.
        </p>
      </header>

      <section className="border-t border-border pt-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Prerequisites</h2>
        <p className="mt-3 max-w-2xl text-foreground">
          Build the harness, the target simulation, and both contracts (reference and attest wasm
          builds per the M1 and M3 records in{" "}
          <a className="text-primary hover:underline" href={`${GITHUB}/docs/ROADMAP.md`}>
            docs/ROADMAP.md
          </a>
          ):
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <pre className="overflow-x-auto border border-border bg-background p-4 font-mono text-sm text-foreground">
            <code>pnpm install &amp;&amp; pnpm -r build</code>
          </pre>
          <pre className="overflow-x-auto border border-border bg-background p-4 font-mono text-sm text-muted-foreground">
            {BUILD_OUTPUT}
          </pre>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Committed build output, verbatim from the repo README.
        </p>
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">The run</h2>
        <Card className="mt-4 max-w-2xl border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Full battery run</CardTitle>
            <CardDescription className="text-muted-foreground">
              Real output from a committed run (README.md, Try it step 2).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <code className="font-mono text-sm text-foreground">pnpm arena:run</code>
              <CopyButton text="pnpm arena:run" />
            </div>
            <pre className="mt-4 overflow-x-auto font-mono text-sm text-foreground">
              {RUN_OUTPUT}
            </pre>
          </CardContent>
        </Card>
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Variants</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] max-w-2xl border-collapse text-sm">
          <tbody>
            <tr className="border-t border-border">
              <td className="w-72 py-3 pr-4 align-top"><code className="font-mono text-sm text-foreground">ARENA_TARGET=gateway|reference</code></td>
              <td className="py-3 align-top text-muted-foreground">
                runs a single target. Unset, the full battery runs against both targets. An unknown
                value exits 2 before any account creation (usageFail,{" "}
                <a className="text-primary hover:underline" href={`${GITHUB}/packages/harness/src/run.ts`}>
                  run.ts
                </a>
                ).
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-3 pr-4 align-top"><code className="font-mono text-sm text-foreground">ARENA_ATTEST=1</code></td>
              <td className="py-3 align-top text-muted-foreground">
                opt-in and the one step that is not secret-free: additionally requires{" "}
                <code className="font-mono">ARENA_ATTEST_ACCOUNT_ID</code> and{" "}
                <code className="font-mono">ARENA_ATTEST_PRIVATE_KEY</code>, a funded testnet
                account of your own (
                <a className="text-primary hover:underline" href={`${GITHUB}/packages/harness/src/attest.ts`}>
                  attest.ts
                </a>
                ), supplied as env vars, never committed. The base run stays secret-free (FR-9, SC-1 in{" "}
                <a className="text-primary hover:underline" href={`${GITHUB}/PRD.md#7-success-criteria--demo-script`}>
                  PRD.md §7
                </a>
                ).
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-3 pr-4 align-top"><code className="font-mono text-sm text-foreground">ARENA_ATTEST_CONTRACT</code></td>
              <td className="py-3 align-top text-muted-foreground">
                point it at your own deployed copy of the attest contract (
                <a className="text-primary hover:underline" href={`${GITHUB}/packages/harness/src/config.ts`}>
                  config.ts
                </a>{" "}
                override).
              </td>
            </tr>
          </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Measured envelope</h2>
        <div className="mt-6 grid gap-10 sm:grid-cols-2">
          <div>
            <div className="font-display text-5xl tabular-nums text-foreground">528 ms</div>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              node startup against the 120 s budget, measured in the M0 spike record (
              <a className="text-primary hover:underline" href={`${GITHUB}/docs/ROADMAP.md`}>
                docs/ROADMAP.md
              </a>
              ).
            </p>
          </div>
          <div>
            <div className="font-display text-5xl tabular-nums text-foreground">2021 ms</div>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              per-tx p95 against the 5 s budget, same record.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">What a run emits</h2>
        <p className="mt-3 max-w-2xl text-foreground">
          One JSON receipt per attack and target at{" "}
          <code className="font-mono text-sm">
            receipts/&lt;attack_id&gt;/&lt;target&gt;-&lt;run_id&gt;.json
          </code>
          . Ten receipts are committed under{" "}
          <code className="font-mono text-sm">receipts/</code> in this repo. Recompute every
          verdict hash and check it on-chain on the{" "}
          <Link className="text-primary hover:underline" href="/verify">
            verify page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
