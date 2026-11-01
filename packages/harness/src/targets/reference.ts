import { readFileSync } from 'node:fs';
import { KeyPair, KeyPairEd25519, functionCall } from 'near-workspaces';
import type { NearAccount } from 'near-workspaces';
import { REFERENCE_WASM, SPEND_GAS } from '../config.js';
import { heightForOutcome, nearApiInternals, sandboxProviderOf, settleOk } from '../near-internals.js';
import type { SandboxProvider } from '../near-internals.js';
import type { ArenaEnv, ArenaTarget, Policy, SignerKey, SpendTxOutcome } from '../types.js';

interface RejectedTxError {
  context?: { transactionHash?: string };
}

/**
 * The reference target: contracts/reference-wallet holds by design. Spend keys are added to
 * the AGENT account (the contract's policy.agent); spends are signed manually per key —
 * near-workspaces' signWithKey routes every signature through one per-account keystore file,
 * which tears under 8 concurrent writers, and its identical-args coalescing collapses the 8
 * A1 submissions into one tx (docs/ROADMAP.md §M0 spike record).
 */
export class ReferenceTarget implements ArenaTarget {
  readonly walletId: string;
  private readonly arena: ArenaEnv;
  /** The wallet account this target binds to: arena.wallet, or the A5 victim. */
  private readonly walletAccount: NearAccount;

  private constructor(arena: ArenaEnv, walletAccount: NearAccount) {
    this.arena = arena;
    this.walletAccount = walletAccount;
    this.walletId = walletAccount.accountId;
  }

  /** Boot the reference wallet on `arena.wallet`, or on any account (A5 victim). */
  static async boot(arena: ArenaEnv, at: NearAccount = arena.wallet): Promise<ReferenceTarget> {
    if (!(await at.exists())) {
      throw new Error(`wallet account ${at.accountId} does not exist`);
    }
    await at.deploy(readFileSync(REFERENCE_WASM));
    await at.call(at, 'new', { owner_id: arena.owner.accountId, ft_account: arena.ft.accountId });
    return new ReferenceTarget(arena, at);
  }

  async setPolicy(policy: Policy): Promise<void> {
    await this.arena.owner.call(this.walletAccount, 'set_policy', {
      agent: this.arena.agent.accountId,
      receiver_allowlist: policy.receiverAllowlist,
      velocity_cap: policy.velocityCap.toString(),
      per_intent_max: policy.perIntentMax === null ? null : policy.perIntentMax.toString(),
    });
  }

  async provisionSpendKeys(count: number): Promise<SignerKey[]> {
    const keys: SignerKey[] = [];
    for (let i = 0; i < count; i++) {
      const kp = KeyPairEd25519.fromRandom();
      await this.arena.agent.batch(this.arena.agent).addKey(kp.getPublicKey()).transact();
      keys.push({ publicKey: kp.getPublicKey().toString(), secretKey: kp.toString() });
    }
    return keys;
  }

  async spend(receiver: string, amount: bigint, signer: SignerKey): Promise<SpendTxOutcome> {
    return this.signedCall(this.arena.agent.accountId, signer, 'spend', {
      receiver_id: receiver,
      amount: amount.toString(),
      nonce: crypto.randomUUID(),
    });
  }

  /**
   * A2 setup: register the resting commitment (agent identity). Setup txs must
   * succeed — a failed setup invalidates the attack rather than shaping the
   * verdict.
   */
  async createCommitment(commitmentId: string, receiver: string, amount: bigint): Promise<void> {
    await this.setupCall(this.arena.agent, 'create_commitment', {
      commitment_id: commitmentId,
      receiver_id: receiver,
      amount: amount.toString(),
    });
  }

  /** A2 setup: the owner freezes the policy. */
  async freeze(): Promise<void> {
    await this.setupCall(this.arena.owner, 'freeze', {});
  }

  /**
   * A2: the trigger condition fires. One on-chain settle attempt — the contract's
   * settle_commitments, which settles nothing post-freeze because freeze cancelled
   * the resting set (W-2).
   */
  async fireTrigger(): Promise<SpendTxOutcome[]> {
    const provider = sandboxProviderOf(this.walletAccount);
    const r = await this.arena.agent.callRaw(this.walletAccount, 'settle_commitments', {}, { gas: SPEND_GAS });
    if (!r.succeeded) {
      throw new Error('settle_commitments failed on the reference wallet');
    }
    return [{ txHash: r.result.transaction.hash, blockHeight: await heightForOutcome(provider, r.result), ok: true }];
  }

  /** A3: submit the intent under its id; the contract consumes the per-intent receipt exactly once (W-3). */
  async submitIntent(intentId: string, receiver: string, amount: bigint, signer: SignerKey): Promise<SpendTxOutcome> {
    return this.signedCall(this.arena.agent.accountId, signer, 'spend_intent', {
      intent_id: intentId,
      receiver_id: receiver,
      amount: amount.toString(),
      nonce: crypto.randomUUID(),
    });
  }

  async issueFunctionCallKey(allowanceYocto: bigint): Promise<SignerKey> {
    const kp = KeyPairEd25519.fromRandom();
    const fcKey = nearApiInternals().functionCallAccessKey(this.walletId, ['spend'], allowanceYocto);
    await this.walletAccount.batch(this.walletAccount).addKey(kp.getPublicKey(), fcKey).transact();
    return { publicKey: kp.getPublicKey().toString(), secretKey: kp.toString() };
  }

  /**
   * Escape path: the FC key (held by the attacker) calls `spend` directly on the wallet with
   * receiver attacker and amount 50 — outside the policy envelope. The contract's check order
   * (allowlist, per-intent max) rejects it on-chain; ok:false IS the reference hold shape.
   */
  async escapeCall(fc: SignerKey, receiver: string, amount: bigint): Promise<SpendTxOutcome> {
    return this.signedCall(this.walletAccount.accountId, fc, 'spend', {
      receiver_id: receiver,
      amount: amount.toString(),
      nonce: crypto.randomUUID(),
    });
  }

  /** A3/A5 setup: the agent proposes a transfer request (no authorization attached). */
  async createRequest(requestId: string, receiver: string, amount: bigint): Promise<void> {
    await this.setupCall(this.arena.agent, 'create_request', {
      request_id: requestId,
      receiver_id: receiver,
      amount: amount.toString(),
    });
  }

  /** A3/A5 setup: the owner approves the request — the INV-5 provenance root. */
  async approveRequest(requestId: string): Promise<void> {
    await this.setupCall(this.arena.owner, 'approve_request', { request_id: requestId });
  }

  /** Setup tx: must succeed — a failed setup invalidates the attack. */
  private async setupCall(caller: NearAccount, method: string, args: Record<string, unknown>): Promise<void> {
    const r = await caller.callRaw(this.walletAccount, method, args, { gas: SPEND_GAS });
    if (!r.succeeded) {
      throw new Error(`${method} failed on ${this.walletId}`);
    }
  }

  /**
   * Sign one policy call on the wallet with an explicit key and submit it directly. The
   * ignored unique nonce field defeats identical-args coalescing (near-sdk 4.1.1 skips
   * unknown JSON fields — verified in the M0 record); A3's identical retry needs it too.
   */
  private async signedCall(signerAccount: string, signer: SignerKey, method: string, args: Record<string, unknown>): Promise<SpendTxOutcome> {
    const kp = KeyPair.fromString(signer.secretKey);
    const nonce = BigInt((await this.walletAccount.viewAccessKey(signerAccount, kp.getPublicKey())).nonce) + 1n;
    const provider = sandboxProviderOf(this.walletAccount);
    const { header } = await provider.block({ finality: 'final' });
    const action = functionCall(
      method,
      args,
      SPEND_GAS,
      0n,
    );
    const { createTransaction, signTransaction, baseDecode, sha256 } = nearApiInternals();
    const tx = createTransaction(signerAccount, kp.getPublicKey(), this.walletId, nonce, [action], baseDecode(header.hash));
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
      // Validation rejects (e.g. an FC key exceeding its allowance) throw before execution.
      const rejection = err as RejectedTxError;
      return { txHash: rejection.context?.transactionHash ?? '', blockHeight: 0, ok: false };
    }
  }
}
