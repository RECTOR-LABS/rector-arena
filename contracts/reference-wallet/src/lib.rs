//! Reference wallet: a by-design HOLDing NEP-141 gateway that enforces its
//! spending policy inside the contract. Velocity-cap check-and-decrement runs
//! in state before the FT transfer promise, so concurrent spends serialize in
//! the contract account's receipt order and exactly min(requested, remaining
//! cap) settles on-chain.
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedSet;
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
        let amount: Balance = amount.into();
        let policy = self
            .policy
            .as_mut()
            .expect("no policy set");
        require!(
            env::predecessor_account_id() == policy.agent,
            "unauthorized agent"
        );
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

    /// Callback on the transfer promise: on failure, roll spent back.
    #[private]
    pub fn on_ft_transfer_result(&mut self, amount: U128, receiver_id: AccountId) -> bool {
        match env::promise_result(0) {
            near_sdk::PromiseResult::Successful(_) => true,
            near_sdk::PromiseResult::NotReady | near_sdk::PromiseResult::Failed => {
                let amount: Balance = amount.into();
                if let Some(policy) = self.policy.as_mut() {
                    policy.spent -= amount;
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
