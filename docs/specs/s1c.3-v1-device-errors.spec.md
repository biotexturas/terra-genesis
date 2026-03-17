# Spec: S1c.3-V1 — Device Error Paths

## Parent Story

S1c.3 — Graceful Failure

## Goal

Audit and test all failure modes in `device init` and `device emit` to ensure every error path produces a clear message on stderr and exits non-zero — no panics, no raw library errors. The error handling infrastructure is already in place from S1b-R4. This spec fills gaps in test coverage.

## Tests First

This is a TEST-FIRST spec. Write failing tests for each gap, then fix any code that panics or produces unclear errors. All tests are integration tests that invoke the compiled `device` binary via `std::process::Command`.

### Test 1: `init_with_unwritable_home_prints_error`

Create a temp dir, create `.hardtrust` as a FILE (not directory) inside it so `create_dir_all` will fail. Run `device init` with HOME set to that temp dir. Assert exit code non-zero, stderr contains `"Error:"`, stderr does NOT contain `"panic"`.

### Test 2: `emit_with_zero_byte_key_prints_error`

Create `~/.hardtrust/device.key` as an empty file (0 bytes). Run `device emit`. Assert exit code non-zero, stderr contains `"Error:"`, stderr does NOT contain `"panic"`.

### Test 3: `emit_with_truncated_key_prints_error`

Create `~/.hardtrust/device.key` containing `"abcd1234\n"` (valid hex, only 4 bytes instead of 32). Run `device emit`. Assert exit code non-zero, stderr contains `"Error:"`, stderr does NOT contain `"panic"`.

### Already covered (no new test needed)

- `emit_with_corrupted_key_prints_error_not_panic` — existing test for non-hex garbage
- `emit_fails_without_key` — existing test for missing key file

## What to Build

Write the 3 new tests. Run them. If they pass without code changes, the error path is already handled — document it. If they fail (panic, unclear error), fix the minimum code in `device/src/main.rs`.

The expectation (based on code audit) is that most tests will pass without code changes, since the S1b-R4 `.map_err()` infrastructure already covers these paths.

## Output Files

| File | Change |
|------|--------|
| `device/src/main.rs` | Add 3 new integration tests. Fix code only if tests reveal a gap. |

## What NOT to Build

- No new error types or error enums
- No changes to `device/src/lib.rs`
- No changes to `protocol/` crate
- No logging, retry logic, or interactive prompts
- No changes to the happy path

## Validation

```bash
cargo test -p device           # all tests pass including 3 new ones
cargo test --workspace         # no regressions
```

## Handoff Prompt

```
Audit device CLI error paths — test-first.

Read the spec at docs/specs/s1c.3-v1-device-errors.spec.md first.

This is a TEST-FIRST task. Write the 3 new integration tests BEFORE any code changes.
Run them. If they pass, the error path is already handled. If they fail, fix minimum code.

Tests to add:
1. init_with_unwritable_home_prints_error
2. emit_with_zero_byte_key_prints_error
3. emit_with_truncated_key_prints_error

After implementation, run: cargo test -p device && cargo test --workspace
Branch: feat/s1c.3-v1-device-errors
```
