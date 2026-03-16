# Spec: S1b.2-V2 — Device Emit with Real Signature (device/ concern)

## Parent Story

S1b.2 — Emit a Cryptographically Signed Reading

## Goal

Update `device emit` to load the device's private key and call `sign_reading` to produce a real ECDSA signature in `reading.json`. This replaces the `"0xFAKESIG"` placeholder. The temperature remains hardcoded at 22.5 for now — real sensor reads are S1c.

## What to Build

### `device/src/main.rs` — update Emit subcommand

#### Key loading

- Path: `~/.hardtrust/device.key`
- Parse file contents as a 64-character lowercase hex string → `[u8; 32]` → `k256::ecdsa::SigningKey`
- If the file does not exist: print `"Device not initialized. Run 'device init' first."` to stderr and exit with a non-zero exit code
- No silent failure — do not fall back to a fake signature

#### Serial

- Read the real machine serial using the same logic introduced in S1b.1-V2
- Do not use `DEV_SERIAL` from `dev_config.rs` (see note below)

#### Address

- Derive the EVM address from the loaded `SigningKey` using `public_key_to_address` (from S1b.1-V1)
- Do not use `DEV_ADDRESS` from `dev_config.rs` (see note below)

#### Signature

- Call `sign_reading(&key, &reading)` from `hardtrust-types` (from S1b.2-V1)

#### Output

Write `reading.json` to the current directory with:
- `serial`: real machine serial
- `address`: derived from loaded key
- `temperature`: `22.5` (hardcoded)
- `timestamp`: `Utc::now().to_rfc3339()`
- `signature`: result of `sign_reading`

#### `dev_config.rs` note

`DEV_SERIAL` and `DEV_ADDRESS` are no longer used by `device emit`. Add a comment marking them unused by this subcommand (same pattern established in S1b.1-V2).

### Output files

- `device/src/main.rs` (update Emit subcommand)

## What NOT to Build

- No changes to `types/` (that is V1)
- No changes to `attester verify` (signature verification is S1b.3)
- No real temperature from hardware (still hardcoded 22.5)
- No configurable output path (hardcoded `"reading.json"`)
- No error handling beyond the key-missing case described above

## Validation

```bash
device init                      # creates ~/.hardtrust/device.key
device emit                      # writes reading.json
cat reading.json                 # signature field is 132-char hex string starting with "0x", not "0xFAKESIG"
just test                        # all tests pass
just e2e-the-wire                # still passes
```

Also validate the missing-key case:

```bash
rm ~/.hardtrust/device.key
device emit                      # prints error message, exits non-zero, does not write reading.json
```

## Dependencies

- S1b.2-V1 must be merged (`sign_reading` available in `hardtrust-types`)
- S1b.1-V2 must be merged (real serial reading logic and key file path established)

## Handoff Prompt

```
Update device emit to load the device key and produce a real ECDSA signature.

Read the spec at docs/specs/s1b.2-v2-device-emit.spec.md first.

Output files:
- Updated device/src/main.rs (update Emit subcommand)

Respect the "What NOT to Build" section strictly.
After implementation, run:
  device init && device emit && cat reading.json
  just test
  just e2e-the-wire
Branch: feat/s1b.2-v2-device-emit
```
