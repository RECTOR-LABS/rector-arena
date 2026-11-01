/**
 * Gateway-side policy simulation (fall-mode ArenaTarget).
 * Spec: docs/plans/M1-harness-gateway.md step 4; docs/ATTACK-BATTERY.md §A1-cap-race, §A4-key-scope-escape.
 * FALLS BY DESIGN under A1: settles 160 > cap 100 (sync-read/await-write race). A4 provisions
 * a real function-call key (W-4 surface) and attempts value movement outside the policy
 * envelope; the outcome is whatever the chain rules (see report: protocol rejects FC-key
 * deposits, so the crafted escape is rejected on-chain).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_FUNCTION_CALL_GAS, KeyPair, KeyPairEd25519, functionCall } from 'near-workspaces';
import type { AccessKey, FinalExecutionOutcome, NearAccount, TransactionResult } from 'near-workspaces';

export interface SignerKey {
  publicKey: string;
  secretKey: string;
}

export interface Policy {
  velocityCap: bigint;
  receiverAllowlist: string[];
  perIntentMax: bigint | null;
}

export interface SpendTxOutcome {
  txHash: string;
  blockHeight: number;
  ok: boolean;
}

export interface ArenaEnv {
  root: NearAccount;
  ft: NearAccount;
  wallet: NearAccount;
  owner: NearAccount;
  agent: NearAccount;
  attacker: NearAccount;
}

// base58 of 32 zero bytes — the code hash nearcore reports for an account with no contract.
const EMPTY_CODE_HASH = '1'.repeat(32);

const FORWARDER_WASM = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'forwarder.wasm');

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
interface NearApiInternals {
  functionCallAccessKey: FunctionCallAccessKeyFn;
  createTransaction: CreateTransactionFn;
  signTransaction: SignTransactionFn;
  baseDecode: BaseDecodeFn;
  sha256: Sha256Fn;
}

let internals: NearApiInternals | null = null;

function nearApiInternals(): NearApiInternals {
  if (internals !== null) return internals;
  const fromHere = createRequire(import.meta.url);
  const fromNearWorkspaces = createRequire(fromHere.resolve('near-workspaces/package.json'));
  const tx = fromNearWorkspaces('near-api-js/lib/transaction') as { functionCallAccessKey: FunctionCallAccessKeyFn; createTransaction: CreateTransactionFn; signTransaction: SignTransactionFn };
  const nu = fromNearWorkspaces('@near-js/utils') as { baseDecode: BaseDecodeFn };
  const hashing = fromNearWorkspaces('@noble/hashes/sha256') as { sha256: Sha256Fn };
  internals = { functionCallAccessKey: tx.functionCallAccessKey, createTransaction: tx.createTransaction, signTransaction: tx.signTransaction, baseDecode: nu.baseDecode, sha256: hashing.sha256 };
  return internals;
}

// ft_transfer is ReceiptOutcome-level: the action succeeds or fails inside the receipt chain,
// so read status off the FinalExecutionOutcome instead of the narrowed TransactionResult type.
function settleOk(outcome: FinalExecutionOutcome): boolean {
  const status = outcome.status as { SuccessValue?: string; SuccessReceiptId?: string; Failure?: object };
  return typeof status === 'object' && status.Failure === undefined;
}

// The re-exported TransactionResult type narrows away transaction_outcome, and EXECUTED_OPTIMISTIC
// outcomes carry only block_hash (no block_height); resolve the settle height via a block query.
function heightForOutcome(provider: SandboxProvider, outcome: FinalExecutionOutcome): Promise<number> {
  return provider.block({ blockId: outcome.transaction_outcome.block_hash }).then(({ header }) => header.height);
}

interface SandboxProvider {
  block(query: { finality: 'final' } | { blockId: string }): Promise<{ header: { hash: string; height: number } }>;
  sendTransaction(signedTx: object): Promise<FinalExecutionOutcome>;
}

interface RejectedTxError {
  context?: { transactionHash?: string };
  message?: string;
}

export class GatewayTarget {
  readonly walletId: string;
  private readonly arena: ArenaEnv;
  private policy: Policy | null = null;
  private spent = 0n;
  private forwarderDeployed = false;

  private constructor(arena: ArenaEnv) {
    this.arena = arena;
    this.walletId = arena.wallet.accountId;
  }

  static async boot(arena: ArenaEnv): Promise<GatewayTarget> {
    if (!(await arena.wallet.exists())) {
      throw new Error(`wallet account ${arena.wallet.accountId} does not exist`);
    }
    if ((await arena.wallet.accountView()).code_hash !== EMPTY_CODE_HASH) {
      throw new Error('wallet must not have a deployed contract');
    }
    return new GatewayTarget(arena);
  }

  async setPolicy(policy: Policy): Promise<void> {
    this.policy = policy;
    this.spent = 0n;
  }

  async provisionSpendKeys(count: number): Promise<SignerKey[]> {
    const signer = await this.arena.wallet.getKey();
    const keys: SignerKey[] = [];
    for (let i = 0; i < count; i++) {
      const kp = KeyPairEd25519.fromRandom();
      await this.arena.wallet.batch(this.arena.wallet).addKey(kp.getPublicKey()).transact(signer ?? undefined);
      keys.push({ publicKey: kp.getPublicKey().toString(), secretKey: kp.toString() });
    }
    return keys;
  }

  /**
   * Best-effort gateway spend: the spent counter is read synchronously BEFORE the awaited
   * on-chain transfer and only incremented after it settles. Concurrent spends therefore all
   * observe the pre-spend counter and all settle — the documented fall under A1.
   */
  async spend(receiver: string, amount: bigint, signer: SignerKey): Promise<SpendTxOutcome> {
    const policy = this.policy;
    if (policy === null) {
      throw new Error('setPolicy must be called before spend');
    }
    const spent = this.spent;
    const withinPolicy =
      spent + amount <= policy.velocityCap &&
      policy.receiverAllowlist.includes(receiver) &&
      (policy.perIntentMax === null || amount <= policy.perIntentMax);
    if (!withinPolicy) {
      return { txHash: '', blockHeight: 0, ok: false };
    }
    const outcome = await this.transferSigned(signer, receiver, amount);
    if (outcome.ok) {
      this.spent = spent + amount;
    }
    return outcome;
  }

  /**
   * Real on-chain function-call key (W-4 surface). Lazily deploys the trusting forwarder at
   * the wallet account, then scopes the key to `forward` on the wallet itself: the wallet's
   * custody IS the forwarder, and the gateway's permitted method is the forward.
   */
  async issueFunctionCallKey(allowanceYocto: bigint): Promise<SignerKey> {
    await this.ensureForwarder();
    const signer = await this.arena.wallet.getKey();
    const kp = KeyPairEd25519.fromRandom();
    const fcAccessKey = nearApiInternals().functionCallAccessKey(this.walletId, ['forward'], allowanceYocto);
    await this.arena.wallet
      .batch(this.arena.wallet)
      .addKey(kp.getPublicKey(), fcAccessKey)
      .transact(signer ?? undefined);
    return { publicKey: kp.getPublicKey().toString(), secretKey: kp.toString() };
  }

  /** Escape path: the FC key calls forward(); the forwarder trusts method args — no policy validation. */
  async escapeCall(fc: SignerKey, receiver: string, amount: bigint): Promise<SpendTxOutcome> {
    await this.ensureForwarder();
    const r = await this.arena.wallet.callRaw(
      this.arena.wallet,
      'forward',
      { receiver_id: receiver, amount: amount.toString() },
      { signWithKey: KeyPair.fromString(fc.secretKey) },
    );
    return { txHash: r.result.transaction.hash, blockHeight: await heightForOutcome(this.sandboxProvider(), r.result), ok: r.succeeded };
  }

  /** NearAccount's provider getter is protected; the Account instance still exposes it at runtime. */
  private sandboxProvider(): SandboxProvider {
    const walletInternals = this.arena.wallet as unknown as { provider: SandboxProvider };
    return walletInternals.provider;
  }

  /** Deploy + init the forwarder at the wallet once per boot; deploying does not touch FT state. */
  private async ensureForwarder(): Promise<void> {
    if (this.forwarderDeployed) return;
    await this.arena.wallet.deploy(readFileSync(FORWARDER_WASM));
    await this.arena.wallet.call(this.arena.wallet, 'new', { ft_account: this.arena.ft.accountId });
    this.forwarderDeployed = true;
  }

  /**
   * Submit ft_transfer signed with an explicit key. near-workspaces' callRaw routes every
   * signature through one per-account keystore slot, which coalesces concurrent spends into a
   * single nonce collision; direct per-key signing keeps the 8 A1 txs genuinely distinct.
   */
  private async transferSigned(signer: SignerKey, receiver: string, amount: bigint): Promise<SpendTxOutcome> {
    const kp = KeyPair.fromString(signer.secretKey);
    const nonce = BigInt((await this.arena.wallet.viewAccessKey(this.walletId, kp.getPublicKey())).nonce) + 1n;
    const provider = this.sandboxProvider();
    const { header } = await provider.block({ finality: 'final' });
    const action = functionCall('ft_transfer', { receiver_id: receiver, amount: amount.toString() }, DEFAULT_FUNCTION_CALL_GAS, 1n);
    const { createTransaction, signTransaction, baseDecode, sha256 } = nearApiInternals();
    const tx = createTransaction(this.walletId, kp.getPublicKey(), this.arena.ft.accountId, nonce, [action], baseDecode(header.hash));
    const keySigner = {
      getPublicKey: async () => kp.getPublicKey(),
      // InMemorySigner hashes the encoded tx with sha256 before signing; mirror that.
      signMessage: async (message: Uint8Array) => ({ signature: kp.sign(new Uint8Array(sha256(message))).signature }),
    };
    const [, signedTx] = await signTransaction(tx, keySigner);
    try {
      const outcome = await provider.sendTransaction(signedTx);
      return { txHash: outcome.transaction.hash, blockHeight: await heightForOutcome(provider, outcome), ok: settleOk(outcome) };
    } catch (err) {
      // Validation rejects (e.g. a function-call key attaching a deposit) throw before execution.
      const rejection = err as RejectedTxError;
      const txHash = rejection.context?.transactionHash ?? '';
      return { txHash, blockHeight: 0, ok: false };
    }
  }
}
