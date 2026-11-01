import { createRequire } from 'node:module';
import type { AccessKey, FinalExecutionOutcome } from 'near-workspaces';

type FunctionCallAccessKeyFn = (receiverId: string, methodNames: string[], allowance?: bigint) => AccessKey;
type CreateTransactionFn = (
  signerId: string,
  publicKey: { toString(): string },
  receiverId: string,
  nonce: bigint,
  actions: object[],
  blockHash: Uint8Array,
) => object;
type SignTransactionFn = (tx: object, signer: object) => Promise<[Uint8Array, object]>;
type BaseDecodeFn = (encoded: string) => Uint8Array;
type Sha256Fn = (message: Uint8Array) => Uint8Array;

// near-workspaces re-exports only a slice of near-api-js; resolve the rest (the FC action
// creator, tx construction/signing, base58, sha256) through near-workspaces' own dependency
// so every signed object is a genuine borsh class. Plain objects fail borsh lookup at sign time.
export interface NearApiInternals {
  functionCallAccessKey: FunctionCallAccessKeyFn;
  createTransaction: CreateTransactionFn;
  signTransaction: SignTransactionFn;
  baseDecode: BaseDecodeFn;
  sha256: Sha256Fn;
}

let internals: NearApiInternals | null = null;

export function nearApiInternals(): NearApiInternals {
  if (internals !== null) return internals;
  const fromHere = createRequire(import.meta.url);
  const fromNearWorkspaces = createRequire(fromHere.resolve('near-workspaces/package.json'));
  const tx = fromNearWorkspaces('near-api-js/lib/transaction') as {
    functionCallAccessKey: FunctionCallAccessKeyFn;
    createTransaction: CreateTransactionFn;
    signTransaction: SignTransactionFn;
  };
  const nu = fromNearWorkspaces('@near-js/utils') as { baseDecode: BaseDecodeFn };
  const hashing = fromNearWorkspaces('@noble/hashes/sha256') as { sha256: Sha256Fn };
  internals = {
    functionCallAccessKey: tx.functionCallAccessKey,
    createTransaction: tx.createTransaction,
    signTransaction: tx.signTransaction,
    baseDecode: nu.baseDecode,
    sha256: hashing.sha256,
  };
  return internals;
}

export interface SandboxProvider {
  block(query: { finality: 'final' } | { blockId: string }): Promise<{ header: { hash: string; height: number } }>;
  sendTransaction(signedTx: object): Promise<FinalExecutionOutcome>;
}

// NearAccount's provider getter is protected; the Account instance still exposes it at runtime.
export function sandboxProviderOf(account: object): SandboxProvider {
  return (account as { provider: SandboxProvider }).provider;
}

// ft_transfer/spend are ReceiptOutcome-level: the action succeeds or fails inside the receipt
// chain, so read status off the FinalExecutionOutcome instead of the narrowed TransactionResult.
export function settleOk(outcome: FinalExecutionOutcome): boolean {
  const status = outcome.status as { Failure?: object };
  return typeof status === 'object' && status.Failure === undefined;
}

// The re-exported TransactionResult type narrows away transaction_outcome, and
// EXECUTED_OPTIMISTIC outcomes carry only block_hash (no block_height); resolve the settle
// height via a block query.
export async function heightForOutcome(provider: SandboxProvider, outcome: FinalExecutionOutcome): Promise<number> {
  return provider.block({ blockId: outcome.transaction_outcome.block_hash }).then(({ header }) => header.height);
}
