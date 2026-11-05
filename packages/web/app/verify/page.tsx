import { CopyButton } from "@/app/components/copy-button";
import { Card, CardContent } from "@/components/ui/card";

const REPO = "https://github.com/RECTOR-LABS/rector-arena/blob/main";

const ARCHITECTURE_URL = `${REPO}/docs/ARCHITECTURE.md#receipt-schema`;
const ATTEST_LIB_URL = `${REPO}/packages/web/lib/attest.ts`;
const ATTEST_CONTRACT_URL = `${REPO}/contracts/attest/src/lib.rs`;
const CONFIG_URL = `${REPO}/packages/harness/src/config.ts`;
const EXPLORER_URL = "https://explorer.testnet.near.org/accounts/attest-ledger.testnet";

const RECOMPUTE_COMMAND = `node -e "const r=require('./receipts/a1-cap-race/gateway-20261101T171313Z.json');const{attack_id,target,verdict,per_account_deltas}=r;console.log(require('node:crypto').createHash('sha256').update(JSON.stringify({attack_id,target,verdict,per_account_deltas})).digest('hex'))"`;

const EXPECTED_HASH = "7343f7caf9735b8461c41d0a1f5482211d73b02b3569d1c22be846dfcb053d20";

const CORE_FIELDS = ["attack_id", "target", "verdict", "per_account_deltas"] as const;

const EXCLUDED_FIELDS = "ran_at, tx_hashes, block_heights";

const STATES: Array<{ state: string; meaning: string }> = [
  { state: "match", meaning: "on-chain verdict_hash equals the receipt's" },
  { state: "mismatch", meaning: "on-chain verdict_hash differs" },
  { state: "unattested", meaning: "no attestation recorded for this attack and target" },
  { state: "rpc-unreachable", meaning: "the testnet RPC could not be queried" },
];

function Chip({ value }: { value: string }) {
  return (
    <code className="border border-border bg-muted px-1.5 py-0.5 font-mono text-sm">{value}</code>
  );
}

export default function VerifyPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl">Verify</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Every verdict receipt commits a SHA-256 hash over a canonical core. Recompute it locally,
        then read the same commitment on NEAR testnet.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">The canonical core</h2>
        <p className="max-w-3xl leading-relaxed">
          A verdict hash covers exactly four fields, serialized in this order:
        </p>
        <p className="flex flex-wrap gap-2">
          {CORE_FIELDS.map((field) => (
            <Chip key={field} value={field} />
          ))}
        </p>
        <p className="max-w-3xl leading-relaxed">
          Everything else in the receipt file ({EXCLUDED_FIELDS}) is excluded from the hash. Equal
          core in, equal hash out, on any machine (
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={ARCHITECTURE_URL}>
            docs/ARCHITECTURE.md, Receipt schema
          </a>
          ).
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Recompute one</h2>
        <p className="max-w-3xl leading-relaxed">
          This command hashes the canonical core of a committed gateway receipt:
        </p>
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <code className="block flex-1 break-all font-mono text-sm leading-relaxed">
                {RECOMPUTE_COMMAND}
              </code>
              <CopyButton text={RECOMPUTE_COMMAND} label="copy" />
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">expected output</p>
              <code className="mt-1 block break-all font-mono text-sm">{EXPECTED_HASH}</code>
              <p className="mt-2 text-sm text-muted-foreground">
                The printed hash equals the verdict_hash field inside that receipt.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Read it on-chain</h2>
        <p className="max-w-3xl leading-relaxed">
          The same commitment is readable straight from NEAR testnet: a view call to{" "}
          <Chip value="get_attestation" /> on contract <Chip value="attest-ledger.testnet" /> with
          args <Chip value={'{"attack_id": "...", "target": "..."}'} /> at finality{" "}
          <Chip value={'"final"'} />. View calls need no account and no key,{" "}
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={ATTEST_LIB_URL}>
            getAttestation
          </a>{" "}
          in packages/web/lib/attest.ts reads the ledger exactly this way.
        </p>
        <p className="text-sm">
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={EXPLORER_URL}>
            Browse the attestation ledger on the testnet explorer
          </a>
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">Who can write</h2>
        <p className="max-w-3xl leading-relaxed">
          The shared ledger is read-only for everyone, and the on-chain <Chip value="attester" />{" "}
          field shows whose attestation you are trusting. Posting is append-once per (attack_id,
          target): re-attesting the same hash is an idempotent no-op, and a conflicting hash panics (
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={ATTEST_CONTRACT_URL}>
            contracts/attest/src/lib.rs
          </a>
          ). That refusal is the tamper evidence.
        </p>
        <p className="max-w-3xl leading-relaxed">
          Builders can attest to their own deployed copy by pointing{" "}
          <Chip value="ARENA_ATTEST_CONTRACT" /> at it (
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={CONFIG_URL}>
            packages/harness/src/config.ts
          </a>
          ).
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-3xl text-foreground md:text-5xl">The four states</h2>
        <p className="max-w-3xl leading-relaxed">
          Each receipt cell resolves to one of four states, mirroring the AttestationState union in{" "}
          <a target="_blank" rel="noreferrer" className="text-primary hover:underline" href={ATTEST_LIB_URL}>
            packages/web/lib/attest.ts
          </a>
          :
        </p>
        <div className="max-w-3xl overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-6 font-medium text-muted-foreground">
                  state
                </th>
                <th scope="col" className="py-2 pr-6 font-medium text-muted-foreground">
                  meaning
                </th>
              </tr>
            </thead>
            <tbody>
              {STATES.map(({ state, meaning }) => (
                <tr key={state} className="border-b border-border last:border-b-0">
                  <td className="py-2 pr-6 align-top">
                    <Chip value={state} />
                  </td>
                  <td className="py-2 pr-6 text-muted-foreground">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
