import { readFileSync } from 'node:fs';
import { KeyPair, KeyPairEd25519, functionCall } from 'near-workspaces';
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

  private constructor(arena: ArenaEnv) {
    this.arena = arena;
    this.walletId = arena.wallet.accountId;
  }

  static async boot(arena: ArenaEnv): Promise<ReferenceTarget> {
    if (!(await arena.wallet.exists())) {
      throw new Error(`wallet account ${arena.wallet.accountId} does not exist`);
    }
    await arena.wallet.deploy(readFileSync(REFERENCE_WASM));
    await arena.wallet.call(arena.wallet, 'new', { owner_id: arena.owner.accountId, ft_account: arena.ft.accountId });
    return new ReferenceTarget(arena);
  }

  async setPolicy(policy: Policy): Promise<void> {
    await this.arena.owner.call(this.arena.wallet, 'set_policy', {
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
    return this.signedSpend(this.arena.agent.accountId, signer, receiver, amount);
  }

  async issueFunctionCallKey(allowanceYocto: bigint): Promise<SignerKey> {
    const kp = KeyPairEd25519.fromRandom();
    const fcKey = nearApiInternals().functionCallAccessKey(this.walletId, ['spend'], allowanceYocto);
    await this.arena.wallet.batch(this.arena.wallet).addKey(kp.getPublicKey(), fcKey).transact();
    return { publicKey: kp.getPublicKey().toString(), secretKey: kp.toString() };
  }

  /**
   * Escape path: the FC key (held by the attacker) calls `spend` directly on the wallet with
   * receiver attacker and amount 50 — outside the policy envelope. The contract's check order
   * (allowlist, per-intent max) rejects it on-chain; ok:false IS the reference hold shape.
   */
  async escapeCall(fc: SignerKey, receiver: string, amount: bigint): Promise<SpendTxOutcome> {
    return this.signedSpend(this.arena.wallet.accountId, fc, receiver, amount);
  }

  /**
   * Sign one `spend` call on the wallet with an explicit key and submit it directly. The
   * ignored unique nonce field defeats identical-args coalescing (near-sdk 4.1.1 skips
   * unknown JSON fields — verified in the M0 record).
   */
  private async signedSpend(signerAccount: string, signer: SignerKey, receiver: string, amount: bigint): Promise<SpendTxOutcome> {
    const kp = KeyPair.fromString(signer.secretKey);
    const nonce = BigInt((await this.arena.wallet.viewAccessKey(signerAccount, kp.getPublicKey())).nonce) + 1n;
    const provider = sandboxProviderOf(this.arena.wallet);
    const { header } = await provider.block({ finality: 'final' });
    const action = functionCall(
      'spend',
      { receiver_id: receiver, amount: amount.toString(), nonce: crypto.randomUUID() },
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
