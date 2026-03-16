# Spec: S1b.2-V1 — sign_reading Function (types/ concern)

## Parent Story

S1b.2 — Emit a Cryptographically Signed Reading

## Goal

Add a `sign_reading` pure function to `types/src/lib.rs` that produces a deterministic 65-byte EVM-format hex signature over a canonical encoding of a `Reading`. This is the shared signing logic — no I/O, no file access, no side effects.

## What to Build

### `types/src/lib.rs` — add `sign_reading`

#### Updated `types/Cargo.toml`

Add dependencies:
- `k256 = { version = "0.13", features = ["ecdsa"] }`
- `sha3 = "0.10"`
- `hex = "0.4"`

#### Function signature

```rust
pub fn sign_reading(key: &k256::ecdsa::SigningKey, reading: &Reading) -> String
```

#### Return value

65-byte EVM-format hex signature: `"0x"` followed by 130 lowercase hex characters (r ++ s ++ v, where v ∈ {0, 1}).

#### Canonical payload (must be exact — verifier will reconstruct this same encoding)

Build a 68-byte preimage in this order:

1. `serial_hash` — `keccak256(reading.serial.as_bytes())` → 32 bytes
2. `address_bytes` — parse `reading.address` as a 20-byte EVM address → 20 bytes
3. `temperature_scaled` — `(reading.temperature * 1000.0) as i64` → 8 bytes big-endian
4. `timestamp_u64` — parse `reading.timestamp` (ISO 8601 UTC) to Unix timestamp as `u64` → 8 bytes big-endian

Concatenate: `serial_hash || address_bytes || temperature_scaled || timestamp_u64` = 68 bytes total.

Then hash: `hash = keccak256(preimage)`.

#### Signing

Call `k256::ecdsa::SigningKey::sign_prehash_recoverable(&hash)`.

- Raw hash signing — NO Ethereum personal sign prefix (`\x19Ethereum Signed Message\n32`)
- Extract `(signature, recovery_id)` from the result
- Encode as: `r_bytes (32) || s_bytes (32) || recovery_id_byte (1)` where `recovery_id_byte` is 0 or 1
- Return `"0x" + hex::encode(r_bytes || s_bytes || recovery_id_byte)`

#### Unit tests

- **Round-trip test:** given a known `SigningKey`, call `sign_reading`, recover the signer address from the returned signature, assert it matches the address derived from the same key via `public_key_to_address` (from S1b.1-V1).
- **Determinism test:** call `sign_reading` twice with identical inputs, assert both returned strings are equal.

### Output files

- `types/Cargo.toml` (add k256, sha3, hex dependencies)
- `types/src/lib.rs` (add `sign_reading` function and unit tests)

## What NOT to Build

- No I/O, no file reading or writing
- No `device emit` changes (that is V2)
- No Ethereum personal sign prefix
- No error handling beyond `.expect()` with descriptive messages

## Validation

```bash
cargo test -p hardtrust-types    # all unit tests pass including sign_reading tests
```

## Dependencies

- S1b.1-V1 must be merged (`public_key_to_address` available in `types/`)

## Handoff Prompt

```
Add the sign_reading function to the hardtrust-types crate.

Read the spec at docs/specs/s1b.2-v1-sign-reading.spec.md first.

Output files:
- Updated types/Cargo.toml (add k256, sha3, hex)
- Updated types/src/lib.rs (add sign_reading function and unit tests)

Respect the "What NOT to Build" section strictly.
After implementation, run `cargo test -p hardtrust-types` to validate.
Branch: feat/s1b.2-v1-sign-reading
```
