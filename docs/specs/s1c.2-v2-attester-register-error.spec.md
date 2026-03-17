# Spec: S1c.2-V2 — Attester CLI Duplicate Registration Error

## Parent Story

S1c.2 — Safe Registration

## Goal

When `attester register` hits a `DeviceAlreadyRegistered` revert from the contract, display a human-readable error message instead of a raw revert trace. Also print a success confirmation with the tx hash on successful registration.

## Dependencies

- S1c.2-V1 must be merged first (contract must revert with `DeviceAlreadyRegistered`)

## Tests First

Integration tests that invoke the compiled `attester` binary (same pattern as existing tests). Require Anvil + deployed contract — use `#[ignore]` attribute.

### Test 1: `test_register_duplicate_shows_human_error`

Deploy contract to Anvil. Register a device. Register the SAME serial again. Assert:
- Exit code is non-zero
- Stderr contains `"device already registered"` (human-readable)
- Stderr does NOT contain raw hex selector or Alloy error trace

### Test 2: `test_register_success_shows_confirmation`

Deploy contract to Anvil. Register a new device. Assert:
- Exit code is zero
- Stdout contains `"Registered device"` and `"tx:"`

## What to Build

### Changes to `attester/src/main.rs`

In the `Command::Register` match arm:

1. **Detect `DeviceAlreadyRegistered` revert** — When the transaction fails, check if the error string contains `DeviceAlreadyRegistered`. If detected, print to stderr: `Error: device already registered (serial hash: 0x...)`

2. **Success confirmation** — On successful registration, print: `Registered device. tx: {tx}`

## Output Files

| File | Change |
|------|--------|
| `attester/src/main.rs` | Update register error handling + success message, add 2 ignored tests |

## What NOT to Build

- No changes to `attester/src/lib.rs`
- No changes to the contract or contract tests (done in V1)
- No retry or re-registration logic
- No changes to `device/` or `protocol/`

## Validation

```bash
cargo build -p attester
cargo test -p attester
cargo test --workspace
```

Ignored integration tests with Anvil:
```bash
anvil &
cd contracts && forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
cargo test -p attester -- --ignored
```

## Handoff Prompt

```
Add human-readable error handling for duplicate device registration in the attester CLI.

Read the spec at docs/specs/s1c.2-v2-attester-register-error.spec.md first.
S1c.2-V1 (contract hardening) must be merged first.

TDD: write the two ignored integration test stubs FIRST, then implement the error handling.

Changes to attester/src/main.rs:
1. Detect "DeviceAlreadyRegistered" in send error → print "device already registered (serial hash: 0x...)"
2. Change success output to "Registered device. tx: {tx}"
3. Add two #[ignore] integration tests

After implementation, run: cargo build -p attester && cargo test -p attester
Branch: feat/s1c.2-v2-attester-register-error
```
