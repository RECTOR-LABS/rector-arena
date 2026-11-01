import type { NearAccount } from 'near-workspaces';

/** One provisioned signing identity (full-access or function-call key material). */
export interface SignerKey {
  publicKey: string;
  secretKey: string;
}

/** Spending policy envelope installed by the owner before each attack. */
export interface Policy {
  velocityCap: bigint;
  receiverAllowlist: string[];
  perIntentMax: bigint | null;
}

/** Terminal on-chain outcome of one settle attempt. */
export interface SpendTxOutcome {
  txHash: string;
  blockHeight: number;
  ok: boolean;
}

/** Deterministic per-run battery environment (docs/ATTACK-BATTERY.md §Shared environment). */
export interface ArenaEnv {
  root: NearAccount;
  ft: NearAccount;
  owner: NearAccount;
  agent: NearAccount;
  wallet: NearAccount;
  attacker: NearAccount;
  recipient: NearAccount;
}

/** A battery target: gateway-replica (falls by design) or reference-wallet (holds by design). */
export interface ArenaTarget {
  walletId: string;
  provisionSpendKeys(count: number): Promise<SignerKey[]>;
  setPolicy(policy: Policy): Promise<void>;
  spend(receiver: string, amount: bigint, signer: SignerKey): Promise<SpendTxOutcome>;
  issueFunctionCallKey(allowanceYocto: bigint): Promise<SignerKey>;
  escapeCall(fc: SignerKey, receiver: string, amount: bigint): Promise<SpendTxOutcome>;
  /** A2: register a resting commitment while the wallet is unfrozen (agent identity). */
  createCommitment(commitmentId: string, receiver: string, amount: bigint): Promise<void>;
  /** A2: the owner freezes the policy. */
  freeze(): Promise<void>;
  /** A2: fire the trigger condition — settle every resting commitment; one outcome per settle attempt. */
  fireTrigger(): Promise<SpendTxOutcome[]>;
  /** A3: submit an intent under its id — exactly-once settlement is the target's contract (W-3). */
  submitIntent(intentId: string, receiver: string, amount: bigint, signer: SignerKey): Promise<SpendTxOutcome>;
}

/** Canonical-core fields plus submission-order hashes — everything a receipt is built from. */
export interface RunResult {
  attackId: 'A1' | 'A2' | 'A3' | 'A4';
  target: 'gateway' | 'reference';
  verdict: 'hold' | 'fall';
  perAccountDeltas: Array<{ account: string; token: string; delta: string }>;
  blockHeights: number[];
  txHashes: string[];
  /** Settled (A1: recipient delta) or escaped (A4: attacker delta) base units. */
  moved: bigint;
}
