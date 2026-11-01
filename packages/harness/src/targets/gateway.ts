import { GatewayTarget } from '@rector-arena/gateway-replica/src/index.js';
import type { ArenaEnv, ArenaTarget, Policy, SignerKey, SpendTxOutcome } from '../types.js';

/** Thin adapter: the landed fall-mode gateway behind the harness' ArenaTarget interface. */
export class GatewayTargetAdapter implements ArenaTarget {
  private constructor(private readonly inner: GatewayTarget) {}

  static async boot(arena: ArenaEnv): Promise<GatewayTargetAdapter> {
    return new GatewayTargetAdapter(await GatewayTarget.boot(arena));
  }

  get walletId(): string {
    return this.inner.walletId;
  }

  provisionSpendKeys(count: number): Promise<SignerKey[]> {
    return this.inner.provisionSpendKeys(count);
  }

  setPolicy(policy: Policy): Promise<void> {
    return this.inner.setPolicy(policy);
  }

  spend(receiver: string, amount: bigint, signer: SignerKey): Promise<SpendTxOutcome> {
    return this.inner.spend(receiver, amount, signer);
  }

  issueFunctionCallKey(allowanceYocto: bigint): Promise<SignerKey> {
    return this.inner.issueFunctionCallKey(allowanceYocto);
  }

  escapeCall(fc: SignerKey, receiver: string, amount: bigint): Promise<SpendTxOutcome> {
    return this.inner.escapeCall(fc, receiver, amount);
  }

  createCommitment(commitmentId: string, receiver: string, amount: bigint): Promise<void> {
    return this.inner.createCommitment(commitmentId, receiver, amount);
  }

  freeze(): Promise<void> {
    return this.inner.freeze();
  }

  fireTrigger(): Promise<SpendTxOutcome[]> {
    return this.inner.fireTrigger();
  }

  submitIntent(intentId: string, receiver: string, amount: bigint, signer: SignerKey): Promise<SpendTxOutcome> {
    return this.inner.submitIntent(intentId, receiver, amount, signer);
  }
}
