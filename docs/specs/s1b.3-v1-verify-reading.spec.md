# Spec: S1b.3-V1 — verify_reading Function

## Parent Story

S1b.3 — Verify a Reading Cryptographically

## Goal

Add a `verify_reading` pure function to `types/src/lib.rs` that recovers the signer address from a reading's ECDSA signature and compares it to an expected on-chain address.

## What to Build

### `verify_reading` in `types/src/lib.rs`

Function signature:

```rust
pub fn verify_reading(reading: &Reading, on_chain_address: alloy::primitives::Address) -> bool
```

Reconstruct the canonical payload hash. This MUST match exactly what `sign_reading` (S1b.2-V1) produces:

1. `serial_hash`: `keccak256(reading.serial.as_bytes())` → 32 bytes
2. `address_bytes`: parse `reading.address` as 20-byte `Address` → 20 bytes
3. `temperature_scaled`: `(reading.temperature * 1000.0) as i64` → 8 bytes big-endian
4. `timestamp_u64`: parse `reading.timestamp` (ISO 8601) to Unix `u64` → 8 bytes big-endian
5. `preimage`: `serial_hash || address_bytes || temperature_scaled || timestamp_u64`
6. `hash`: `keccak256(preimage)`

Recovery:

- Parse `reading.signature` (hex string) as Alloy `Signature` type
- Recover signer: `Signature::recover_address_from_prehash(&B256::from(hash))`

Return value:

- `true` if: recovery succeeds AND `recovered_address == on_chain_address` AND `on_chain_address != Address::ZERO`
- `false` for any other case: malformed signature (parse error → false, not panic), wrong signer, zero address

### ADR-0007

This function intentionally uses raw prehash with NO Ethereum personal sign prefix (EIP-191). Device readings are machine-to-machine payloads. Document this design decision as ADR-0007 in `docs/adr/` during implementation.

### Unit Tests (no Anvil required)

- `sign_reading(key, reading)` → `verify_reading(reading_with_sig, derived_address)` → `true`
- Tamper temperature → `false`
- Tamper timestamp → `false`
- Tamper serial → `false`
- Fake signature `"0xFAKESIG"` → `false` (not panic)
- `on_chain_address = Address::ZERO` → `false`

### Output Files

- `types/src/lib.rs` (updated)
- `docs/adr/0007-no-personal-sign-prefix.md` (new)

## What NOT to Build

- No I/O — pure function only
- No contract calls
- No CLI changes
- No changes to `attester/` (that is V2)

## Validation

```bash
cargo test -p hardtrust-types    # all unit tests pass including round-trip tamper tests
just build
just test
```

## Handoff Prompt

```
Add verify_reading to the types crate.

Read the spec at docs/specs/s1b.3-v1-verify-reading.spec.md first.
S1b.2-V1 (sign_reading) must be merged first — the round-trip unit test depends on it.

Output files:
- Updated types/src/lib.rs (add verify_reading pub fn)
- New docs/adr/0007-no-personal-sign-prefix.md

The canonical payload hash construction MUST match sign_reading exactly — same field order, same encoding, same keccak256 steps.
Return false (never panic) for any malformed or unrecoverable signature.
Respect the "What NOT to Build" section strictly.
After implementation, run `cargo test -p hardtrust-types` to validate.
Branch: feat/s1b.3-v1-verify-reading
```
