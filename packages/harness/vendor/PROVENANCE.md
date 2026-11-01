# FT wasm provenance

- Source repo: https://github.com/near/near-sdk-rs
- Tag: `4.1.1` (newest tag whose example FT wasm compiles in the near-sandbox runtime shipped with `near-workspaces@5.0.0`; see compatibility note below)
- Commit: `55020df8e99057815685b75b70955cb79a9dfe28` (4.1.1)
- Artifact: `examples/fungible-token/ft` release build, `fungible_token.wasm` → vendored here as `ft.wasm`
- Build date: 2026-11-01 (UTC)
- Build commands (deterministic reproduction):
  ```
  git clone --depth 1 --branch 4.1.1 https://github.com/near/near-sdk-rs
  RUSTFLAGS="-C target-feature=-reference-types" \
    cargo +1.85 build --release --target wasm32-unknown-unknown \
    --manifest-path examples/fungible-token/ft/Cargo.toml
  ```
  `rustup toolchain install 1.85 --profile minimal --target wasm32-unknown-unknown` provides the toolchain.
- NEP-141 methods: `ft_transfer`, `ft_transfer_call`, `ft_on_transfer`, `ft_resolve_transfer`, `ft_balance_of`, `ft_total_supply`; storage: `storage_deposit`, `storage_withdraw`, `storage_balance_of`, `storage_unregister`, `storage_minimum_balance`; plus `new`, `mint`, `burn`
- License: MIT OR Apache-2.0 (near-sdk-rs dual license)

## Sandbox compatibility note (M0 finding)

Wasm emitted by rustc ≥ 1.86 with default target features fails `PrepareError::Deserialization`
in the sandbox runtime (`near-sandbox` 0.1.5 → neard 2.6.2, protocol 77, itself the binary pinned
by `near-workspaces@5.0.0`); disabling `reference-types` at build time fixes it. near-sdk 5.x
example wasm fails the same prepare step on that sandbox regardless of build flags, so 4.1.1 is
the operational ceiling for the M0/M1 sandbox. Revisit if the sandbox pin moves (near-sandbox 0.2+
changes its binary layout and is incompatible with `near-workspaces@5.0.0`).
