# Spec: S1a.2-V2 — Attester Verify

## Parent Story

S1a.2 — Verify Data from a Registered Device

## Goal

Add a `verify` subcommand to the attester CLI that reads a `reading.json` file, queries the on-chain registry, and prints VERIFIED or UNVERIFIED based on address match.

## What to Build

### Dependencies in `attester/Cargo.toml`

Add to existing dependencies:

```toml
hardtrust-types = { path = "../types" }
serde_json = "1"
```

### `verify` subcommand in `attester/src/main.rs`

Add `Verify` variant to the existing clap `Commands` enum:

```
attester verify --file <PATH> --contract <ADDRESS>
```

Behavior:
1. Read `--file` path to string
2. Deserialize to `Reading` struct (from `hardtrust-types`)
3. Parse `reading.address` to alloy `Address`
4. Compute `keccak256(reading.serial.as_bytes())` for the serial hash
5. Query contract `getDevice(serialHash)` using existing `sol!` macro
6. Compare returned `deviceAddr` with the reading's address using `is_verified()`
7. Print `VERIFIED` or `UNVERIFIED`

### Provider: read-only, no signer

The `register` subcommand uses a signer (Anvil #1 private key). Verify only reads, so use a plain provider:

```rust
let provider = ProviderBuilder::new()
    .connect_http("http://127.0.0.1:8545".parse().expect("valid URL"));
```

No private key, no wallet.

### Extract `is_verified` pure function

```rust
fn is_verified(on_chain_addr: Address, reading_addr: Address) -> bool {
    on_chain_addr != Address::ZERO && on_chain_addr == reading_addr
}
```

This is the TDD anchor: a pure function testable without Anvil.

### Unit tests (no Anvil required)

- `is_verified` returns `true` when addresses match (non-zero)
- `is_verified` returns `false` when addresses differ
- `is_verified` returns `false` when `on_chain_addr` is `Address::ZERO` (unregistered device)
- `Reading` JSON round-trip: deserialize a sample JSON string and assert all fields

### Integration test (marked `#[ignore]`)

- Start Anvil, deploy contract, register device, create `reading.json`, run verify, assert `VERIFIED`
- Mark with `#[ignore]` since it requires Anvil

### Output files

- `attester/Cargo.toml` (updated)
- `attester/src/main.rs` (updated)

## What NOT to Build

- No real signature verification (ECDSA is S1b)
- No UNVERIFIED path in integration tests (that's V3/S1a.3)
- No configurable RPC URL
- No error handling beyond `.expect()` with descriptive messages
- No `bindings/` crate extraction (`sol!` stays in attester)

## Validation

```bash
cargo test -p attester               # unit tests pass (is_verified + JSON parse)

# Integration (requires Anvil + deployed contract + registered device + reading.json):
# cargo test -p attester -- --ignored
```

## Handoff Prompt

```
Add the verify subcommand to the attester CLI.

Read the spec at docs/specs/s1a.2-v2-attester-verify.spec.md first.
V1 (types crate + device emit) must be merged first.

Output files:
- Updated attester/Cargo.toml (add hardtrust-types, serde_json)
- Updated attester/src/main.rs (add Verify subcommand + is_verified fn)

Use a plain provider without signer for verify (read-only call).
Extract is_verified() as a pure function with unit tests.
Respect the "What NOT to Build" section strictly.
After implementation, run `cargo test -p attester` to validate unit tests.
Branch: feat/s1a.2-v2-attester-verify
```
