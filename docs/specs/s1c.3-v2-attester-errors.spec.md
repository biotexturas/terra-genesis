# Spec: S1c.3-V2 — Attester Error Paths

## Parent Story

S1c.3 — Graceful Failure

## Goal

Audit and test all failure modes in `attester register` and `attester verify` to ensure every error path produces a clear message and exits non-zero — no panics, no raw library errors. The error handling infrastructure is already in place from S1b-R4. This spec fills gaps in test coverage.

## Tests First

This is a TEST-FIRST spec. Write failing tests, then fix any code that panics or produces unclear errors. All tests invoke the compiled `attester` binary via `std::process::Command`.

### Test 1: `register_with_invalid_address_prints_error`

Run `attester register --serial TEST-001 --device-address NOT_AN_ADDRESS --contract 0x0000000000000000000000000000000000000000`. Assert exit code non-zero, output contains an error about the address, output does NOT contain `"panic"`.

Note: clap parses `Address` type — will reject before `run()` is called.

### Test 2: `register_with_invalid_contract_prints_error`

Run `attester register --serial TEST-001 --device-address 0x0000000000000000000000000000000000000001 --contract GARBAGE`. Assert exit code non-zero, output contains an error about the address/contract, output does NOT contain `"panic"`.

### Test 3: `verify_with_missing_fields_prints_error`

Write a temp file containing `{"serial":"X","address":"Y","temperature":1.0}` (valid JSON but missing `timestamp` and `signature` fields). Run `attester verify --file <path> --contract 0x0000000000000000000000000000000000000000`. Assert exit code non-zero, stderr contains `"Error:"`, stderr contains `"missing field"`, stderr does NOT contain `"panic"`.

### Test 4: `verify_with_empty_file_prints_error`

Write a temp file with empty contents (0 bytes). Run `attester verify --file <path> --contract 0x0000000000000000000000000000000000000000`. Assert exit code non-zero, stderr contains `"Error:"`, stderr does NOT contain `"panic"`.

### Already covered (no new test needed)

- `verify_with_nonexistent_file_prints_error_not_panic` — existing
- `verify_with_bad_json_prints_error_not_panic` — existing

## What to Build

Write the 4 new tests. Run them. If they pass without code changes, the error path is already handled. If they fail, fix minimum code in `attester/src/main.rs`.

The expectation is that all tests will pass without code changes — serde_json and clap handle these cases, and the existing `.map_err()` infrastructure surfaces the errors.

## Output Files

| File | Change |
|------|--------|
| `attester/src/main.rs` | Add 4 new integration tests. Fix code only if tests reveal a gap. |

## What NOT to Build

- No new error types or error enums
- No changes to `attester/src/lib.rs`
- No changes to `protocol/` crate
- No custom clap validators — clap's built-in parsing is sufficient
- No logging, retry logic, or interactive prompts
- No network error handling (out of scope per story)
- No changes to the happy path

## Dependencies

- Can run in PARALLEL with S1c.3-V1 (independent binaries)

## Validation

```bash
cargo test -p attester         # all tests pass including 4 new ones
cargo test --workspace         # no regressions
```

## Handoff Prompt

```
Audit attester CLI error paths — test-first.

Read the spec at docs/specs/s1c.3-v2-attester-errors.spec.md first.

This is a TEST-FIRST task. Write the 4 new integration tests BEFORE any code changes.
Run them. If they pass, the error path is already handled. If they fail, fix minimum code.

Tests to add:
1. register_with_invalid_address_prints_error
2. register_with_invalid_contract_prints_error
3. verify_with_missing_fields_prints_error
4. verify_with_empty_file_prints_error

After implementation, run: cargo test -p attester && cargo test --workspace
Branch: feat/s1c.3-v2-attester-errors
```
