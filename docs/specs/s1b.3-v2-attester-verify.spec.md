# Spec: S1b.3-V2 — Attester Verify

## Parent Story

S1b.3 — Verify a Reading Cryptographically

## Goal

Replace `is_verified()` in `attester/src/main.rs` with `verify_reading()` from `hardtrust-types`, so that the verify subcommand uses real ECDSA recovery instead of plain address comparison.

## What to Build

### Delete `is_verified()` from `attester/src/main.rs`

Remove the `is_verified()` function entirely.

### Import `verify_reading` from `hardtrust-types`

Add the import in `attester/src/main.rs`:

```rust
use hardtrust_types::verify_reading;
```

### Update the `verify` subcommand

Replace the call to `is_verified()` with `verify_reading()`:

- Call `verify_reading(reading, on_chain_address)` where `on_chain_address` is the address returned by the contract `getDevice` query
- The contract interaction does not change — `on_chain_address` still comes from the on-chain registry
- Output format is unchanged: print `VERIFIED` or `UNVERIFIED` to stdout
- CLI arguments are unchanged: `--file`, `--contract`

### Unit Tests

- Update or remove any unit tests that reference `is_verified()` directly
- No new unit tests required in attester — the crypto logic is covered in V1 (types crate)

### Output Files

- `attester/src/main.rs` (updated)

## What NOT to Build

- No new CLI arguments
- No changes to contract interaction or provider setup
- No changes to output format
- No error handling beyond what already exists

## Validation

```bash
just e2e-the-wire        # VERIFIED for registered device, UNVERIFIED for fake-reading.json
just build
just test

# Manual tamper test:
# Edit any field in reading.json (temperature, timestamp, serial, or address)
# Run: attester verify --file reading.json --contract <addr>
# Expected: UNVERIFIED
```

## Handoff Prompt

```
Replace is_verified() with verify_reading() in the attester CLI.

Read the spec at docs/specs/s1b.3-v2-attester-verify.spec.md first.
S1b.3-V1 (verify_reading in types/) must be merged first.

Output files:
- Updated attester/src/main.rs (delete is_verified, import and call verify_reading)

The CLI interface, contract interaction, and output format must not change.
Respect the "What NOT to Build" section strictly.
After implementation, run `just e2e-the-wire` and `just build` and `just test` to validate.
Branch: feat/s1b.3-v2-attester-verify
```
