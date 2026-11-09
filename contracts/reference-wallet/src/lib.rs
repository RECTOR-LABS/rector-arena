//! Reference wallet: a by-design HOLDing NEP-141 gateway that enforces its
//! spending policy inside the contract. Velocity-cap check-and-decrement runs
//! in state before the FT transfer promise, so concurrent spends serialize in
//! the contract account's receipt order and exactly min(requested, remaining
//! cap) settles on-chain.
//!
//! M2 hold surfaces: owner freeze cancels every resting commitment (W-2), and
//! per-intent receipts are consumed exactly once (W-3).
//!
//! M3 hold surface: request-flow provenance (INV-5). Keyed settlement
//! (`spend_intent`) settles only an intent id that names an OWNER-APPROVED
//! request with matching receiver and amount — the agent can propose requests,
//! only the owner approves them, so poisoned content alone can never mint an
//! authorization (A5).
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{UnorderedMap, UnorderedSet};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{
    env, near_bindgen, require, AccountId, Balance, Gas, PanicOnDefault, Promise, PromiseOrValue,
};

const NO_DEPOSIT: Balance = 0;
const FT_TRANSFER_DEPOSIT: Balance = 1;
/// Forwarded gas for the ft_transfer promise; remainder of the attached gas
/// flows into the callback.
const FT_TRANSFER_GAS: Gas = Gas(50_000_000_000_000);
/// Gas reserved for the revert/confirm callback.
const CALLBACK_GAS: Gas = Gas(20_000_000_000_000);

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct ReferenceWallet {
    owner: AccountId,
    ft_account: AccountId,
    policy: Option<Policy>,
    /// Owner freeze flag. Freezing also cancels every resting commitment (W-2).
    frozen: bool,
    /// Resting commitments by id: authorized while unfrozen, settled when the
    /// trigger condition fires (W-2).
    commitments: UnorderedMap<String, Commitment>,
    /// Consumed per-intent receipts: an intent id settles at most once (W-3).
    intents: UnorderedSet<String>,
    /// Transfer requests by id: proposed by the agent, approved by the owner.
    /// Keyed settlement requires an approved request with matching args (INV-5).
    requests: UnorderedMap<String, Request>,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Policy {
    agent: AccountId,
    receiver_allowlist: UnorderedSet<AccountId>,
    velocity_cap: Balance,
    spent: Balance,
    per_intent_max: Option<Balance>,
}

#[near_bindgen]
impl ReferenceWallet {
    /// The wallet subaccount IS this contract: initialize at deploy time.
    #[init]
    pub fn new(owner_id: AccountId, ft_account: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self {
            owner: owner_id,
            ft_account,
            policy: None,
            frozen: false,
            commitments: UnorderedMap::new(b"c".to_vec()),
            intents: UnorderedSet::new(b"i".to_vec()),
            requests: UnorderedMap::new(b"r".to_vec()),
        }
    }

    /// Owner-only. Resets spent to 0 (fresh window) and installs the policy.
    pub fn set_policy(
        &mut self,
        agent: AccountId,
        receiver_allowlist: Vec<AccountId>,
        velocity_cap: U128,
        per_intent_max: Option<U128>,
    ) {
        require!(
            env::predecessor_account_id() == self.owner,
            "only owner can set policy"
        );
        require!(!receiver_allowlist.is_empty(), "receiver allowlist is empty");
        let mut allowlist = UnorderedSet::new(b"a".to_vec());
        for r in receiver_allowlist {
            allowlist.insert(&r);
        }
        self.policy = Some(Policy {
            agent,
            receiver_allowlist: allowlist,
            velocity_cap: velocity_cap.into(),
            spent: 0,
            per_intent_max: per_intent_max.map(Into::into),
        });
    }

    /// Agent entry point. Check order is spec-pinned: authn, allowlist,
    /// per-intent cap, velocity cap; then state mutates BEFORE the transfer
    /// promise so concurrent receipts serialize against `spent`.
    pub fn spend(&mut self, receiver_id: AccountId, amount: U128) -> PromiseOrValue<bool> {
        self.execute_spend(None, receiver_id, amount)
    }

    /// Agent entry point with per-intent idempotency (W-3) and request-flow
    /// provenance (INV-5): the per-intent receipt is consumed exactly once — a
    /// replayed intent id aborts and the total moved is unchanged — and the
    /// intent id must name an OWNER-APPROVED request whose receiver and amount
    /// match the call args. Check order is spec-pinned: authn, request-flow
    /// provenance (approved + args match), intent-id unconsumed, allowlist,
    /// per-intent cap, velocity cap. A FAILED transfer releases the receipt in
    /// the callback, so a client retry after a genuinely failed settlement
    /// stays legitimate.
    pub fn spend_intent(
        &mut self,
        intent_id: String,
        receiver_id: AccountId,
        amount: U128,
    ) -> PromiseOrValue<bool> {
        self.execute_spend(Some(intent_id), receiver_id, amount)
    }

    fn execute_spend(
        &mut self,
        intent_id: Option<String>,
        receiver_id: AccountId,
        amount: U128,
    ) -> PromiseOrValue<bool> {
        let amount: Balance = amount.into();
        let policy = self
            .policy
            .as_mut()
            .expect("no policy set");
        require!(
            env::predecessor_account_id() == policy.agent,
            "unauthorized agent"
        );
        if let Some(id) = &intent_id {
            // Request-flow provenance (INV-5): the intent id must name an
            // owner-approved request whose receiver and amount match — checked
            // BEFORE consumption, so an unapproved id never burns its receipt.
            let request = match self.requests.get(id) {
                Some(r) if r.approved => r,
                Some(_) => panic!("request {} is not approved", id),
                None => panic!("no request registered for intent id {}", id),
            };
            require!(
                request.receiver_id == receiver_id && request.amount == amount,
                "settlement args diverge from the approved request"
            );
            require!(!self.intents.contains(id), "intent already settled");
        }
        require!(
            policy.receiver_allowlist.contains(&receiver_id),
            "receiver not allowlisted"
        );
        if let Some(per_intent_max) = policy.per_intent_max {
            require!(amount <= per_intent_max, "amount exceeds per-intent max");
        }
        require!(
            policy.spent.saturating_add(amount) <= policy.velocity_cap,
            "cap exceeded"
        );
        policy.spent += amount;
        if let Some(id) = &intent_id {
            self.intents.insert(id);
        }
        let spent_after: Balance = policy.spent;

        let args = json!({
            "receiver_id": receiver_id,
            "amount": amount.to_string(),
            "memo": Option::<String>::None,
        });
        let transfer = Promise::new(self.ft_account.clone()).function_call(
            "ft_transfer".to_string(),
            near_sdk::serde_json::to_vec(&args).expect("args serialize"),
            FT_TRANSFER_DEPOSIT,
            FT_TRANSFER_GAS,
        );
        let callback_args = json!({
            "amount": amount.to_string(),
            "receiver_id": receiver_id,
            "intent_id": intent_id,
        });
        let callback = Promise::new(env::current_account_id()).function_call(
            "on_ft_transfer_result".to_string(),
            near_sdk::serde_json::to_vec(&callback_args).expect("callback args serialize"),
            NO_DEPOSIT,
            CALLBACK_GAS,
        );
        transfer.then(callback);

        env::log_str(
            &json!({
                "standard": "rector-arena-policy",
                "version": "1.0.0",
                "event": "spend_settled",
                "data": {
                    "receiver_id": receiver_id,
                    "amount": amount.to_string(),
                    "spent_after": spent_after.to_string(),
                },
            })
            .to_string(),
        );
        // The promise chain settles the on-chain truth; the local return is
        // advisory only.
        PromiseOrValue::Value(true)
    }

    /// Agent-only. Proposes a transfer request through the request flow.
    /// Proposing carries NO authorization: settlement additionally requires the
    /// owner's approval (INV-5), so a request born from poisoned content can
    /// never settle by itself (A5).
    pub fn create_request(&mut self, request_id: String, receiver_id: AccountId, amount: U128) {
        let policy = self
            .policy
            .as_ref()
            .expect("no policy set");
        require!(
            env::predecessor_account_id() == policy.agent,
            "unauthorized agent"
        );
        require!(
            self.requests.get(&request_id).is_none(),
            "request id already registered"
        );
        self.requests.insert(
            &request_id,
            &Request { receiver_id: receiver_id.clone(), amount: amount.into(), approved: false },
        );
        env::log_str(
            &json!({
                "standard": "rector-arena-policy",
                "version": "1.0.0",
                "event": "request_created",
                "data": {
                    "request_id": request_id,
                    "receiver_id": receiver_id,
                    "amount": amount.0.to_string(),
                },
            })
            .to_string(),
        );
    }

    /// Owner-only. Approves a proposed request — the act that makes its intent
    /// id settleable (the INV-5 provenance root). Approval does not spend: the
    /// unconsumed-receipt, allowlist, per-intent, and velocity-cap checks all
    /// still apply at settlement time.
    pub fn approve_request(&mut self, request_id: String) {
        require!(
            env::predecessor_account_id() == self.owner,
            "only owner can approve requests"
        );
        let mut request = self
            .requests
            .get(&request_id)
            .expect("no request registered for id");
        require!(!request.approved, "request already approved");
        request.approved = true;
        self.requests.insert(&request_id, &request);
        env::log_str(
            &json!({
                "standard": "rector-arena-policy",
                "version": "1.0.0",
                "event": "request_approved",
                "data": { "request_id": request_id },
            })
            .to_string(),
        );
    }

    /// Callback on the transfer promise: on failure, roll spent back and
    /// release the intent receipt (if any) so a legitimate retry proceeds.
    #[private]
    pub fn on_ft_transfer_result(
        &mut self,
        amount: U128,
        _receiver_id: AccountId,
        intent_id: Option<String>,
    ) -> bool {
        match env::promise_result(0) {
            near_sdk::PromiseResult::Successful(_) => true,
            near_sdk::PromiseResult::NotReady | near_sdk::PromiseResult::Failed => {
                let amount: Balance = amount.into();
                if let Some(policy) = self.policy.as_mut() {
                    policy.spent = policy.spent.saturating_sub(amount);
                }
                if let Some(id) = intent_id {
                    self.intents.remove(&id);
                }
                env::log_str(
                    &json!({
                        "standard": "rector-arena-policy",
                        "version": "1.0.0",
                        "event": "spend_reverted",
                        "data": { "amount": amount.to_string() },
                    })
                    .to_string(),
                );
                false
            }
        }
    }

    /// Agent-only. Registers a resting commitment — settle `amount` to
    /// `receiver_id` when the trigger condition holds. Authorization happens
    /// once, at creation: unfrozen wallet, fresh id, allowlisted receiver,
    /// within the remaining velocity cap.
    pub fn create_commitment(
        &mut self,
        commitment_id: String,
        receiver_id: AccountId,
        amount: U128,
    ) {
        let amount: Balance = amount.into();
        let policy = self
            .policy
            .as_ref()
            .expect("no policy set");
        require!(
            env::predecessor_account_id() == policy.agent,
            "unauthorized agent"
        );
        require!(!self.frozen, "wallet is frozen");
        require!(
            self.commitments.get(&commitment_id).is_none(),
            "commitment id already registered"
        );
        require!(
            policy.receiver_allowlist.contains(&receiver_id),
            "receiver not allowlisted"
        );
        require!(
            policy.spent.saturating_add(amount) <= policy.velocity_cap,
            "cap exceeded"
        );
        self.commitments
            .insert(&commitment_id, &Commitment { receiver_id: receiver_id.clone(), amount });
        env::log_str(
            &json!({
                "standard": "rector-arena-policy",
                "version": "1.0.0",
                "event": "commitment_registered",
                "data": {
                    "commitment_id": commitment_id,
                    "receiver_id": receiver_id,
                    "amount": amount.to_string(),
                },
            })
            .to_string(),
        );
    }

    /// Owner-only. Freezes the wallet AND cancels every resting commitment —
    /// W-2: no pre-freeze authorization settles post-freeze, ever.
    pub fn freeze(&mut self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "only owner can freeze"
        );
        self.frozen = true;
        let cancelled = self.commitments.len();
        self.commitments.clear();
        env::log_str(
            &json!({
                "standard": "rector-arena-policy",
                "version": "1.0.0",
                "event": "wallet_frozen",
                "data": { "cancelled_commitments": cancelled },
            })
            .to_string(),
        );
    }

    /// Agent-only, fired when the trigger condition holds: settles every
    /// resting commitment that fits the remaining velocity cap. A frozen
    /// wallet settles nothing — freeze already cancelled the commitments
    /// (W-2) — so the post-freeze settled total is 0 by construction.
    pub fn settle_commitments(&mut self) -> PromiseOrValue<U128> {
        let policy = self
            .policy
            .as_ref()
            .expect("no policy set");
        require!(
            env::predecessor_account_id() == policy.agent,
            "unauthorized agent"
        );
        if self.frozen || self.commitments.is_empty() {
            return PromiseOrValue::Value(U128(0));
        }
        let remaining = policy.velocity_cap - policy.spent;
        let mut budget = remaining;
        let mut planned: Vec<PlannedSettlement> = Vec::new();
        let mut settled_ids: Vec<String> = Vec::new();
        for (id, commitment) in self.commitments.iter() {
            if commitment.amount <= budget {
                budget -= commitment.amount;
                settled_ids.push(id.clone());
                planned.push(PlannedSettlement {
                    commitment_id: id,
                    amount: U128(commitment.amount),
                    receiver_id: commitment.receiver_id,
                });
            }
        }
        if planned.is_empty() {
            return PromiseOrValue::Value(U128(0));
        }
        let count = planned.len() as u64;
        require!(
            env::prepaid_gas().0 >= count * (FT_TRANSFER_GAS.0 + CALLBACK_GAS.0),
            "attached gas too low for commitment settlement"
        );
        // Leave the resting set BEFORE the transfer promises (in-flight); the
        // callback re-rests any commitment whose transfer failed.
        for id in &settled_ids {
            self.commitments.remove(id);
        }
        let total: Balance = planned.iter().map(|p| p.amount.0).sum();
        let policy = self.policy.as_mut().expect("no policy set");
        policy.spent += total;

        let ft = self.ft_account.clone();
        let mut head: Option<Promise> = None;
        for p in &planned {
            let args = json!({
                "receiver_id": p.receiver_id,
                "amount": p.amount.0.to_string(),
                "memo": Option::<String>::None,
            });
            let promise = Promise::new(ft.clone()).function_call(
                "ft_transfer".to_string(),
                near_sdk::serde_json::to_vec(&args).expect("args serialize"),
                FT_TRANSFER_DEPOSIT,
                FT_TRANSFER_GAS,
            );
            head = Some(match head {
                None => promise,
                Some(chain) => chain.and(promise),
            });
        }
        let callback_args = near_sdk::serde_json::to_vec(&json!({ "planned": planned }))
            .expect("callback args serialize");
        head.expect("planned is non-empty").then(
            Promise::new(env::current_account_id()).function_call(
                "on_commitments_result".to_string(),
                callback_args,
                NO_DEPOSIT,
                Gas(CALLBACK_GAS.0 * count),
            ),
        );
        env::log_str(
            &json!({
                "standard": "rector-arena-policy",
                "version": "1.0.0",
                "event": "commitments_settling",
                "data": {
                    "count": count,
                    "total": total.to_string(),
                },
            })
            .to_string(),
        );
        // The promise chain settles the on-chain truth; the local return is
        // advisory only.
        PromiseOrValue::Value(U128(total))
    }

    /// Callback on the batched commitment transfers: settled commitments stay
    /// out of the resting set; failures refund the spent counter and re-rest
    /// the commitment.
    #[private]
    pub fn on_commitments_result(&mut self, planned: Vec<PlannedSettlement>) -> U128 {
        let mut settled: Balance = 0;
        for (i, p) in planned.iter().enumerate() {
            match env::promise_result(i as u64) {
                near_sdk::PromiseResult::Successful(_) => settled += p.amount.0,
                near_sdk::PromiseResult::NotReady | near_sdk::PromiseResult::Failed => {
                    if let Some(policy) = self.policy.as_mut() {
                        policy.spent = policy.spent.saturating_sub(p.amount.0);
                    }
                    self.commitments.insert(
                        &p.commitment_id,
                        &Commitment { receiver_id: p.receiver_id.clone(), amount: p.amount.0 },
                    );
                }
            }
        }
        env::log_str(
            &json!({
                "standard": "rector-arena-policy",
                "version": "1.0.0",
                "event": "commitments_settled",
                "data": { "settled": settled.to_string() },
            })
            .to_string(),
        );
        U128(settled)
    }

    pub fn get_policy(&self) -> PolicyView {
        match &self.policy {
            Some(p) => PolicyView {
                owner: self.owner.clone(),
                agent: p.agent.clone(),
                receiver_allowlist: p.receiver_allowlist.to_vec(),
                velocity_cap: U128(p.velocity_cap),
                spent: U128(p.spent),
                per_intent_max: p.per_intent_max.map(U128),
            },
            None => PolicyView {
                owner: self.owner.clone(),
                agent: env::current_account_id(),
                receiver_allowlist: vec![],
                velocity_cap: U128(0),
                spent: U128(0),
                per_intent_max: None,
            },
        }
    }

    /// One request by id (W-5 recompute + provenance audits).
    pub fn get_request(&self, request_id: String) -> Option<RequestView> {
        self.requests.get(&request_id).map(|r| RequestView {
            request_id,
            receiver_id: r.receiver_id,
            amount: U128(r.amount),
            approved: r.approved,
        })
    }

    /// Every recorded request, oldest-index first.
    pub fn get_requests(&self) -> Vec<RequestView> {
        self.requests
            .iter()
            .map(|(id, r)| RequestView {
                request_id: id,
                receiver_id: r.receiver_id,
                amount: U128(r.amount),
                approved: r.approved,
            })
            .collect()
    }
}

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PolicyView {
    pub owner: AccountId,
    pub agent: AccountId,
    pub receiver_allowlist: Vec<AccountId>,
    pub velocity_cap: U128,
    pub spent: U128,
    pub per_intent_max: Option<U128>,
}

/// A resting commitment registered pre-freeze (W-2).
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Commitment {
    receiver_id: AccountId,
    amount: Balance,
}

/// A transfer request proposed by the agent: settleable only after the owner
/// approves it (INV-5 request-flow provenance).
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Request {
    receiver_id: AccountId,
    amount: Balance,
    approved: bool,
}

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct RequestView {
    pub request_id: String,
    pub receiver_id: AccountId,
    pub amount: U128,
    pub approved: bool,
}

/// One planned commitment settlement — an entry of the settle→callback arg
/// vector.
#[derive(near_sdk::serde::Serialize, near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PlannedSettlement {
    commitment_id: String,
    amount: U128,
    receiver_id: AccountId,
}
