# Spec: S1b.1-V1 — Key Generation (types/ concern)

## Parent Story

S1b.1 — Generate a Real Device Identity

## Goal

Add a pure `public_key_to_address` function to the `types/` crate that derives an Ethereum address from a secp256k1 public key. This is a library function only — no I/O, no key generation, no side effects. It exists so that address derivation logic is shared and tested in isolation before being consumed by `device init` in V2.

## What to Build

### `types/Cargo.toml`

- Add dependency: `k256 = { version = "0.13", features = ["ecdsa"] }`
- `alloy` is already present (used by the existing types crate)

### `types/src/lib.rs`

- Add function:
  ```
  pub fn public_key_to_address(pk: &k256::ecdsa::VerifyingKey) -> alloy::primitives::Address
  ```
- Implementation steps:
  1. Encode the public key as uncompressed bytes (65 bytes, 0x04 prefix)
  2. Strip the 0x04 prefix — use only the 64-byte body (X and Y coordinates)
  3. Apply keccak256 to those 64 bytes
  4. Take the last 20 bytes of the hash
  5. Return as `alloy::primitives::Address`
- Unit test — known test vector (Anvil account #0):
  - Private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
  - Expected address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
  - Derive `VerifyingKey` from the private key, call `public_key_to_address`, assert the result matches the expected address (case-insensitive checksum comparison)

## What NOT to Build

- No key generation (no `SigningKey`, no `OsRng`) — that is V2
- No file I/O of any kind
- No CLI changes
- No changes to the `Reading` struct or any existing type
- No new crates or workspace members

## Validation

```bash
cargo test -p hardtrust-types    # unit test passes with known test vector
cargo build                      # workspace still compiles cleanly
```

## Dependencies

- Depends on: S1a.2-V1 (types crate exists with alloy already in scope)
- Required by: S1b.1-V2 (device init imports this function)

## Handoff Prompt

```
Add the public_key_to_address function to the hardtrust-types crate.

Read the spec at context/specs/s1b.1-v1-key-generation.spec.md first.

Output files:
- types/Cargo.toml (add k256 dependency)
- types/src/lib.rs (add public_key_to_address function and unit test)

Respect the "What NOT to Build" section strictly.
After implementation, run `cargo test -p hardtrust-types` to validate.
Branch: feat/s1b.1-v1-key-generation
```
