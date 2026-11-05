export interface AttackCopy {
  title: string;
  weakness: string;
  adversary: string;
  mechanic: string;
  oracle: string;
  fall: string;
  hold: string;
  specAnchor: string;
}

// Weakness labels mirror the README results table "Weakness class" column verbatim.
// Adversary values mirror the per-attack Adversary lines in docs/ATTACK-BATTERY.md.
// Amounts mirror the committed receipts (README results table).
export const ATTACK_COPY: Record<string, AttackCopy> = {
  A1: {
    title: "cap race",
    weakness: "concurrent spends vs velocity cap",
    adversary: "A-racer",
    mechanic:
      "8 spends of 20 race a velocity cap of 100. The gateway's spent counter is read before any transfer resolves, so all 8 settle. The reference serializes check-and-decrement in-contract: 5 land, 3 abort cap-exceeded.",
    oracle: "settled total = ft_balance_of(recipient)",
    fall: "160 settle, cap 100",
    hold: "exactly 100 settle",
    specAnchor: "a1-cap-race--concurrent-spends-vs-velocity-cap",
  },
  A2: {
    title: "freeze bypass",
    weakness: "resting commitment settles after freeze",
    adversary: "A-racer",
    mechanic:
      "A commitment for 25 is registered, then the wallet is frozen. The gateway honors the resting order; the reference cancels outstanding commitments at freeze.",
    oracle: "post-freeze settled total",
    fall: "25 settle post-freeze",
    hold: "0 settle post-freeze",
    specAnchor: "a2-freeze-bypass--post-freeze-settlement-of-a-resting-commitment",
  },
  A3: {
    title: "needs-review double spend",
    weakness: "ambiguous status + client retry",
    adversary: "A-counterparty",
    mechanic:
      "Intent I for 30 ends in an ambiguous status after broadcast. The client retries with identical parameters. The gateway settles again; the reference consumed its per-intent receipt once and aborts the retry.",
    oracle: "total moved across both attempts",
    fall: "60 settle, one intent paid twice",
    hold: "30 settle, retry aborts",
    specAnchor: "a3-needs-review-double-spend--ambiguous-status--client-retry",
  },
  A4: {
    title: "key-scope escape",
    weakness: "function-call key moves value outside the policy envelope",
    adversary: "A-key",
    mechanic:
      "The attacker crafts a call on the wallet's function-call key: receiver attacker, amount 50, outside the allowlist and the per-intent max of 10. The gateway forwarder trusts method args; the reference validates receiver and amount per intent and the tx fails.",
    oracle: "attacker balance delta",
    fall: "50 settle outside the envelope",
    hold: "0 settle outside the envelope",
    specAnchor: "a4-key-scope-escape--function-call-key-chains-value-outside-intent",
  },
  A5: {
    title: "injection-to-payment",
    weakness: "poisoned content drives a drain",
    adversary: "A-injection",
    mechanic:
      "A poisoned email instructs the agent to transfer the victim's full balance to the attacker. The gateway accepts the agent-signed transfer; the reference requires an owner-approved request and settles nothing.",
    oracle: "victim balance delta + verdict receipt presence",
    fall: "victim drained of the full 200",
    hold: "0; provenance blocks the drain",
    specAnchor: "a5-injection-to-payment--poisoned-content-drives-a-drain",
  },
};
