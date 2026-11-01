//! Receipt attestation for rector-arena: records verdict hashes on NEAR
//! testnet so every battery receipt is explorer-verifiable (FR-8, SC-3 in
//! `PRD.md` §5/§7). The harness posts one `attest()` call per receipt when
//! `ARENA_ATTEST=1` (docs/ARCHITECTURE.md §Attestation flow).
//!
//! Tamper-evidence: one record per (attack_id, target); re-attesting the SAME
//! hash is an idempotent no-op (safe retries), a DIFFERENT hash aborts.
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::serde_json::json;
use near_sdk::{env, near_bindgen, require, AccountId, PanicOnDefault};

/// Registry-legal attack ids (PRD.md §0: A1..A5 are immutable).
fn require_attack_id(attack_id: &str) {
    require!(
        matches!(attack_id, "A1" | "A2" | "A3" | "A4" | "A5"),
        "attack_id must be one of A1..A5"
    );
}

/// Registry-legal targets (docs/ATTACK-BATTERY.md §Targets registry).
fn require_target(target: &str) {
    require!(target == "gateway" || target == "reference", "target must be gateway or reference");
}

/// Verdict hashes are SHA-256 hex digests: exactly 64 lowercase hex chars.
fn require_verdict_hash(verdict_hash: &str) {
    require!(
        verdict_hash.len() == 64,
        "verdict_hash must be a 64-char sha256 hex digest"
    );
    require!(
        verdict_hash
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()),
        "verdict_hash must be lowercase hex"
    );
}

fn record_key(attack_id: &str, target: &str) -> String {
    format!("{}:{}", attack_id, target)
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Attestations {
    /// Keyed by `<attack_id>:<target>` — one verdict per battery cell.
    records: UnorderedMap<String, Attestation>,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Attestation {
    attack_id: String,
    target: String,
    verdict_hash: String,
    attester: AccountId,
    block_height: u64,
    timestamp: u64,
}

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AttestationView {
    pub attack_id: String,
    pub target: String,
    pub verdict_hash: String,
    pub attester: AccountId,
    pub block_height: u64,
    pub timestamp: u64,
}

#[near_bindgen]
impl Attestations {
    #[init]
    pub fn new() -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self { records: UnorderedMap::new(b"r".to_vec()) }
    }

    /// Records the verdict hash for (attack_id, target). Idempotent for an
    /// identical re-attest; a conflicting hash aborts, so the on-chain record
    /// is tamper-evident.
    pub fn attest(&mut self, attack_id: String, target: String, verdict_hash: String) {
        require_attack_id(&attack_id);
        require_target(&target);
        require_verdict_hash(&verdict_hash);
        let key = record_key(&attack_id, &target);
        match self.records.get(&key) {
            Some(existing) => {
                require!(existing.verdict_hash == verdict_hash, "attestation hash conflict");
            }
            None => {
                self.records.insert(
                    &key,
                    &Attestation {
                        attack_id: attack_id.clone(),
                        target: target.clone(),
                        verdict_hash: verdict_hash.clone(),
                        attester: env::predecessor_account_id(),
                        block_height: env::block_height(),
                        timestamp: env::block_timestamp(),
                    },
                );
            }
        }
        env::log_str(
            &json!({
                "standard": "rector-arena-attest",
                "version": "1.0.0",
                "event": "attestation_recorded",
                "data": {
                    "attack_id": attack_id,
                    "target": target,
                    "verdict_hash": verdict_hash,
                },
            })
            .to_string(),
        );
    }

    /// The recorded verdict hash for one battery cell, if attested.
    pub fn get_attestation(&self, attack_id: String, target: String) -> Option<AttestationView> {
        self.records.get(&record_key(&attack_id, &target)).map(|a| AttestationView {
            attack_id: a.attack_id,
            target: a.target,
            verdict_hash: a.verdict_hash,
            attester: a.attester,
            block_height: a.block_height,
            timestamp: a.timestamp,
        })
    }

    /// Every recorded attestation — the view the leaderboard and the
    /// verification procedure read back.
    pub fn get_attestations(&self) -> Vec<AttestationView> {
        self.records
            .iter()
            .map(|(_, a)| AttestationView {
                attack_id: a.attack_id,
                target: a.target,
                verdict_hash: a.verdict_hash,
                attester: a.attester,
                block_height: a.block_height,
                timestamp: a.timestamp,
            })
            .collect()
    }

    pub fn attestation_count(&self) -> u64 {
        self.records.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const HASH_A: &str = "5b061574a0893d8b8bdba5752902dd499aed52358b732bcb13b37de3bb98a701";
    const HASH_B: &str = "076eb0c7a1c88b1ee9ed7cbefce97941b7ca8058249c21c9284b3c34b4f0efbd";

    fn env_as(attester: &str) {
        let mut ctx = VMContextBuilder::new();
        ctx.current_account_id("attest.testnet".parse().unwrap());
        ctx.predecessor_account_id(attester.parse().unwrap());
        testing_env!(ctx.build());
    }

    #[test]
    fn records_and_reads_back_an_attestation() {
        env_as("harness.testnet");
        let mut contract = Attestations::new();
        contract.attest("A1".into(), "gateway".into(), HASH_A.into());
        let view = contract
            .get_attestation("A1".into(), "gateway".into())
            .expect("attestation recorded");
        assert_eq!(view.verdict_hash, HASH_A);
        assert_eq!(view.attester, "harness.testnet".parse::<AccountId>().unwrap());
        assert_eq!(contract.attestation_count(), 1);
        assert!(contract.get_attestation("A1".into(), "reference".into()).is_none());
    }

    #[test]
    fn identical_re_attest_is_idempotent() {
        env_as("harness.testnet");
        let mut contract = Attestations::new();
        contract.attest("A5".into(), "reference".into(), HASH_A.into());
        contract.attest("A5".into(), "reference".into(), HASH_A.into());
        assert_eq!(contract.attestation_count(), 1);
    }

    #[test]
    #[should_panic(expected = "attestation hash conflict")]
    fn conflicting_hash_for_recorded_pair_aborts() {
        env_as("harness.testnet");
        let mut contract = Attestations::new();
        contract.attest("A3".into(), "gateway".into(), HASH_A.into());
        contract.attest("A3".into(), "gateway".into(), HASH_B.into());
    }

    #[test]
    fn lists_all_records() {
        env_as("harness.testnet");
        let mut contract = Attestations::new();
        contract.attest("A1".into(), "gateway".into(), HASH_A.into());
        contract.attest("A1".into(), "reference".into(), HASH_B.into());
        let all = contract.get_attestations();
        assert_eq!(all.len(), 2);
        let hashes: Vec<&str> = all.iter().map(|a| a.verdict_hash.as_str()).collect();
        assert!(hashes.contains(&HASH_A) && hashes.contains(&HASH_B));
    }

    #[test]
    #[should_panic(expected = "attack_id")]
    fn rejects_unknown_attack_id() {
        env_as("harness.testnet");
        let mut contract = Attestations::new();
        contract.attest("A9".into(), "gateway".into(), HASH_A.into());
    }

    #[test]
    #[should_panic(expected = "target")]
    fn rejects_unknown_target() {
        env_as("harness.testnet");
        let mut contract = Attestations::new();
        contract.attest("A1".into(), "mainnet".into(), HASH_A.into());
    }

    #[test]
    #[should_panic(expected = "verdict_hash")]
    fn rejects_short_hash() {
        env_as("harness.testnet");
        let mut contract = Attestations::new();
        contract.attest("A1".into(), "gateway".into(), "abcd".into());
    }

    #[test]
    #[should_panic(expected = "verdict_hash")]
    fn rejects_uppercase_hash() {
        env_as("harness.testnet");
        let mut contract = Attestations::new();
        contract.attest("A1".into(), "gateway".into(), HASH_A.to_uppercase());
    }
}
