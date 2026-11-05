import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "rector-arena: How it works",
  description:
    "From a mainnet fork to an attested leaderboard: how the rector-arena exploit battery runs.",
};

const GITHUB = "https://github.com/RECTOR-LABS/rector-arena/blob/main";

function FlowBox({ x, y, w, label }: { x: number; y: number; w: number; label: React.ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={36} fill="var(--card)" stroke="var(--border)" strokeWidth="1" />
      <text
        x={x + w / 2}
        y={y + 18}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fill="currentColor"
      >
        {label}
      </text>
    </g>
  );
}

function Arrow({ d }: { d: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="var(--muted-foreground)"
      strokeWidth="1.5"
      markerEnd="url(#how-arrow)"
    />
  );
}

export default function HowItWorksPage() {
  return (
    <main className="pb-16">
      <h1 className="mt-6 font-display text-4xl">How it works</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        From a mainnet fork to an attested leaderboard, in one command.
      </p>

      <div className="mx-auto mt-8 max-w-2xl text-foreground">
        <svg
          viewBox="0 0 760 470"
          role="img"
          aria-label="Battery flow from mainnet fork to attested ledger"
          className="h-auto w-full"
        >
          <defs>
            <marker
              id="how-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
            </marker>
          </defs>

          <FlowBox x={230} y={2} w={300} label="mainnet fork" />
          <FlowBox x={230} y={54} w={300} label="near-sandbox" />
          <FlowBox x={230} y={106} w={300} label="battery A1..A5" />
          <FlowBox
            x={90}
            y={160}
            w={270}
            label={
              <>
                gateway-replica{" "}
                <tspan fill="var(--fall)">(falls)</tspan>
              </>
            }
          />
          <FlowBox
            x={400}
            y={160}
            w={270}
            label={
              <>
                reference <tspan fill="var(--hold)">(holds)</tspan>
              </>
            }
          />
          <FlowBox x={230} y={216} w={300} label="on-chain balance deltas" />
          <FlowBox x={230} y={270} w={300} label="receipt JSON" />
          <FlowBox x={230} y={324} w={300} label="SHA-256 canonical core" />
          <FlowBox x={230} y={378} w={300} label="attest-ledger.testnet" />
          <FlowBox x={230} y={432} w={300} label="leaderboard" />

          <Arrow d="M 380 38 L 380 52" />
          <Arrow d="M 380 90 L 380 104" />
          <Arrow d="M 380 142 L 225 157" />
          <Arrow d="M 380 142 L 535 157" />
          <Arrow d="M 225 196 L 368 213" />
          <Arrow d="M 535 196 L 392 213" />
          <Arrow d="M 380 252 L 380 268" />
          <Arrow d="M 380 306 L 380 322" />
          <Arrow d="M 380 360 L 380 376" />
          <Arrow d="M 380 414 L 380 430" />
        </svg>
      </div>

      <section className="mt-12 max-w-2xl">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Two targets</h2>
        <p className="mt-2">
          <code className="bg-muted px-1">ARENA_TARGET=gateway|reference</code> runs a single target.
          Unset, the harness runs the full battery on both. A set but unknown value exits with code 2
          before any account creation (
          <a className="text-primary hover:underline" href={`${GITHUB}/packages/harness/src/run.ts`}>
            packages/harness/src/run.ts
          </a>
          ). The gateway-replica falls every attack; the reference holds.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">The oracle</h2>
        <p className="mt-2">
          Verdicts read on-chain state alone (W-5): <code className="bg-muted px-1">ft_balance_of</code>{" "}
          for token balances and view calls for account state, never logs or events (
          <a className="text-primary hover:underline" href={`${GITHUB}/packages/harness/src/oracle.ts`}>
            packages/harness/src/oracle.ts
          </a>
          ).
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">The fork</h2>
        <p className="mt-2">
          The sandbox boots from a mainnet RPC fork, a decision recorded in the M0 spike record.
          Node startup 528 ms against the 120 s budget. Per-tx p95 2021 ms against the 5 s budget (
          <a className="text-primary hover:underline" href={`${GITHUB}/docs/ROADMAP.md`}>
            docs/ROADMAP.md
          </a>
          ).
        </p>
      </section>

      <p className="mt-12 max-w-2xl">
        Ready to reproduce it?{" "}
        <Link className="text-primary hover:underline" href="/battery">
          Run the battery
        </Link>
        .
      </p>
    </main>
  );
}
