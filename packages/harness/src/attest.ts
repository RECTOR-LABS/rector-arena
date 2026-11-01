import { JsonRpcProvider, KeyPair, functionCall } from 'near-workspaces';
import type { FinalExecutionOutcome } from 'near-workspaces';
import { ATTEST } from './config.js';
import { nearApiInternals, settleOk } from './near-internals.js';
import type { Receipt } from './receipt.js';

/**
 * Attestation flow (FR-8, docs/ARCHITECTURE.md §Attestation flow): with `ARENA_ATTEST=1`
 * the harness posts one `attest(attack_id, target, verdict_hash)` tx per receipt to the
 * `attest` contract on NEAR testnet and verifies the recorded hash via a view call.
 * Retries: 3 attempts, 2 s backoff, same verdict_hash (PRD.md §8). Credentials come from
 * the environment at run time (per-repo .env convention) — never committed; the battery's
 * default path never touches this module (FR-9, SC-1). The runner gates on
 * `process.env.ARENA_ATTEST === '1'` before calling into this module.
 */

interface AttestCreds {
  accountId: string;
  keyPair: KeyPair;
}

function requireCreds(): AttestCreds {
  const accountId = process.env.ARENA_ATTEST_ACCOUNT_ID;
  const secretKey = process.env.ARENA_ATTEST_PRIVATE_KEY;
  if (!accountId || !secretKey) {
    throw new Error(
      'ARENA_ATTEST=1 requires ARENA_ATTEST_ACCOUNT_ID and ARENA_ATTEST_PRIVATE_KEY in the environment (per-repo .env convention)',
    );
  }
  return { accountId, keyPair: KeyPair.fromString(secretKey) };
}

interface AccessKeyView {
  nonce: string | number;
  block_hash: string;
}

interface ViewCallResult {
  result: number[];
}

interface TestnetProvider {
  block(query: { finality: 'final' }): Promise<{ header: { hash: string } }>;
  query(query: Record<string, unknown>): Promise<unknown>;
  sendTransaction(signedTx: object): Promise<FinalExecutionOutcome>;
}

function providerOf(url: string): TestnetProvider {
  return JsonRpcProvider.from(url) as unknown as TestnetProvider;
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/** View the recorded hash for (attack_id, target); null when the cell is unattested. */
export async function readAttestation(attack_id: string, target: string): Promise<string | null> {
  const argsBase64 = Buffer.from(JSON.stringify({ attack_id, target })).toString('base64');
  let lastErr: unknown;
  for (const url of ATTEST.rpcCandidates) {
    try {
      const raw = await providerOf(url).query({
        request_type: 'call_function',
        finality: 'final',
        account_id: ATTEST.contract,
        method_name: 'get_attestation',
        args_base64: argsBase64,
      });
      const bytes = (raw as ViewCallResult).result;
      const json = JSON.parse(Buffer.from(bytes).toString('utf8')) as { verdict_hash: string } | null;
      return json === null ? null : json.verdict_hash;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`get_attestation view failed on all testnet RPC candidates: ${String(lastErr)}`);
}

/** Post one attest tx for a receipt; resolve only when the chain records the exact hash. */
export async function postAttest(receipt: Receipt): Promise<string> {
  const creds = requireCreds();
  const args = {
    attack_id: receipt.attack_id,
    target: receipt.target,
    verdict_hash: receipt.verdict_hash,
  };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= ATTEST.attempts; attempt++) {
    for (const url of ATTEST.rpcCandidates) {
      try {
        return await sendAttestTx(creds, url, args);
      } catch (err) {
        lastErr = err;
        console.error(`attest attempt ${attempt}/${ATTEST.attempts} via ${url} failed: ${String(err)}`);
      }
    }
    if (attempt < ATTEST.attempts) await delay(ATTEST.backoffMs);
  }
  throw new Error(`attest tx for ${receipt.attack_id}/${receipt.target} failed after ${ATTEST.attempts} attempts: ${String(lastErr)}`);
}

async function sendAttestTx(
  creds: AttestCreds,
  url: string,
  args: { attack_id: string; target: string; verdict_hash: string },
): Promise<string> {
  const provider = providerOf(url);
  const accessKey = (await provider.query({
    request_type: 'view_access_key',
    finality: 'final',
    account_id: creds.accountId,
    public_key: creds.keyPair.getPublicKey().toString(),
  })) as AccessKeyView;
  const nonce = BigInt(accessKey.nonce) + 1n;
  const { header } = await provider.block({ finality: 'final' });
  const action = functionCall('attest', args, ATTEST.gas, 0n);
  const { createTransaction, signTransaction, baseDecode, sha256 } = nearApiInternals();
  const tx = createTransaction(
    creds.accountId,
    creds.keyPair.getPublicKey(),
    ATTEST.contract,
    nonce,
    [action],
    baseDecode(header.hash),
  );
  const keySigner = {
    getPublicKey: async () => creds.keyPair.getPublicKey(),
    // InMemorySigner hashes the encoded tx with sha256 before signing; mirror that.
    signMessage: async (message: Uint8Array) => ({
      signature: creds.keyPair.sign(new Uint8Array(sha256(message))).signature,
    }),
  };
  const [, signedTx] = await signTransaction(tx, keySigner);
  const outcome = await provider.sendTransaction(signedTx);
  if (!settleOk(outcome)) {
    throw new Error(`attest tx failed on-chain: ${JSON.stringify(outcome.status)}`);
  }
  // Verifiability: the recorded hash must equal the receipt's hash (view call). The view
  // can lag the tx at final — poll briefly before declaring a mismatch, so a healthy
  // attestation never triggers a redundant re-attest.
  let recorded: string | null = null;
  for (let i = 0; i < 4; i++) {
    await delay(1_500);
    recorded = await readAttestation(args.attack_id, args.target);
    if (recorded === args.verdict_hash) return outcome.transaction.hash;
  }
  throw new Error(`attested hash mismatch: recorded ${recorded}, expected ${args.verdict_hash}`);
}
