# Spec: S1a.2-V1 — Types Crate & Device Emit

## Parent Story

S1a.2 — Verify Data from a Registered Device

## Goal

A shared types library crate (`hardtrust-types`) defining the `Reading` struct, and a `device emit` subcommand that writes a hardcoded reading to a JSON file. This is a pure data layer — no verification, no crypto, no network calls.

The `types/` crate is a LIBRARY crate: no binary, no I/O, no side effects. The `device emit` subcommand is the only place that performs I/O (writing the file).

## What to Build

### Part 1: `types/` crate (library)

#### `types/Cargo.toml`

- Crate name: `hardtrust-types`
- Dependencies: `serde = { version = "1", features = ["derive"] }`
- No other dependencies

#### `types/src/lib.rs`

- `Reading` struct with all fields `pub`:
  - `serial`: `String`
  - `address`: `String`
  - `temperature`: `f64`
  - `timestamp`: `String` (ISO 8601 UTC)
  - `signature`: `String` (placeholder for now)
- Derives: `Debug`, `Clone`, `Serialize`, `Deserialize`, `PartialEq`
- Unit tests:
  - Reading serializes to JSON (verify all 5 fields present)
  - Reading round-trips through serde (serialize then deserialize, assert equality)
  - Reading with a missing field fails to deserialize

### Part 2: `device emit` subcommand

#### Updated `device/Cargo.toml`

- Add dependencies:
  - `hardtrust-types = { path = "../types" }`
  - `serde_json = "1"`
  - `chrono = { version = "0.4", features = ["serde"] }`

#### Updated `device/src/main.rs`

- Add `Emit` variant to existing CLI subcommands
- Emit creates a `Reading` with:
  - `serial` = `SERIAL` constant (already exists: `"HARDCODED-001"`)
  - `address` = `ADDRESS` constant (already exists)
  - `temperature` = `42.0`
  - `timestamp` = `Utc::now().to_rfc3339()`
  - `signature` = `"0xFAKESIG"`
- Writes `reading.json` to current directory using `serde_json::to_string_pretty`
- Prints `"Wrote reading.json"`
- Test: run `device emit`, read the file back, verify it deserializes to a valid `Reading` with expected values (serial, address, temperature)

### Updated `Cargo.toml` (workspace root)

- Add `"types"` to workspace members list

### Output files

- `types/Cargo.toml`
- `types/src/lib.rs`
- `Cargo.toml` (root — add `"types"` to workspace members)
- `device/Cargo.toml` (add hardtrust-types, serde_json, chrono)
- `device/src/main.rs` (add Emit subcommand)

## What NOT to Build

- No signature generation (real crypto is S1b)
- No configurable output path (hardcoded `"reading.json"`)
- No verify logic (that is V2)
- No `bindings/` crate (not needed yet — only attester calls contract)
- No error handling beyond `.expect()` with descriptive messages

## Parallelization Note

V1 and V2 are parallelizable. V2 (attester verify) does not depend on V1 being merged first — the attester can define `Reading` locally if needed. Ideally V1 lands first so V2 imports from `hardtrust-types` directly.

## Validation

```bash
cargo test -p hardtrust-types    # unit tests pass
cargo test -p device             # tests pass including emit test
cargo run --bin device -- emit   # writes reading.json
cat reading.json                 # valid JSON with all 5 fields
```

## Handoff Prompt

```
Create the hardtrust-types crate and add the emit subcommand to the device CLI.

Read the spec at docs/specs/s1a.2-v1-types-and-device-emit.spec.md first.

Output files:
- types/Cargo.toml
- types/src/lib.rs
- Updated Cargo.toml (root — add "types" to workspace members)
- Updated device/Cargo.toml (add hardtrust-types, serde_json, chrono)
- Updated device/src/main.rs (add Emit subcommand)

Respect the "What NOT to Build" section strictly.
After implementation, run `cargo test -p hardtrust-types && cargo test -p device && cargo run --bin device -- emit` to validate.
Branch: feat/s1a.2-v1-types-and-device-emit
```
