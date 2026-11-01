//! Minimal trusting forwarder — gateway-replica fall mode under A4-key-scope-escape.
//! The `forward` method validates NOTHING about receiver or amount: it forwards the call to
//! the battery FT verbatim with its own 1-yoctoNEAR deposit. A function-call key scoped to
//! `forward` on this contract therefore moves value outside any policy envelope.
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::{
    env, ext_contract, near_bindgen, require, AccountId, Balance, Gas, PanicOnDefault, Promise,
};

// 20 Tgas
pub const FT_TRANSFER_GAS: Gas = Gas(20_000_000_000_000);

#[allow(dead_code)]
#[ext_contract(ext_fungible_token)]
trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Forwarder {
    ft_account: LazyOption<AccountId>,
}

#[near_bindgen]
impl Forwarder {
    #[init]
    pub fn new(ft_account: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self { ft_account: LazyOption::new(b"f".to_vec(), Some(&ft_account)) }
    }

    pub fn forward(&mut self, receiver_id: AccountId, amount: U128) -> Promise {
        let ft_account = self.ft_account.get().unwrap();
        ext_fungible_token::ext(ft_account)
            .with_attached_deposit(1 as Balance)
            .with_static_gas(FT_TRANSFER_GAS)
            .ft_transfer(receiver_id, amount, None)
    }
}
