# Spec: S1b.1-V2 — Device Init (device/ concern)

## Parent Story

S1b.1 — Generate a Real Device Identity

## Goal

Rewrite the `device init` subcommand to generate a real secp256k1 keypair, read the hardware serial number (with an emulation fallback), persist the private key to disk, and print the serial and address. Running `device init` twice does not overwrite the existing key. Nothing else changes — `device emit`, the attester, and the contract are untouched.

## What to Build

### `device/Cargo.toml`

- Add dependencies:
  - `k256 = { version = "0.13", features = ["ecdsa"] }`
  - `rand_core = { version = "0.6", features = ["getrandom"] }` (for `OsRng`)

### `device/src/main.rs` — `init` subcommand

Replace the existing hardcoded `device init` implementation with the following behavior, in order:

**1. Key guard**

- If `~/.hardtrust/device.key` exists:
  - Print: `Device identity already exists. Run with --force to regenerate.`
  - Exit with code 0 (not an error)
- Do not implement `--force` — only print the message above

**2. Read hardware serial**

- Attempt to read `/sys/firmware/devicetree/base/serial-number`
- If the file exists and is non-empty: use its trimmed contents as the serial
- If not (no file, permission error, empty): fall back to emulation mode:
  - Try to read `/etc/hostname`; if unavailable try the `HOSTNAME` environment variable; if both absent use the literal string `unknown`
  - Serial = `EMULATED-<hostname>`

**3. Generate keypair**

- Generate a secp256k1 private key using `k256::ecdsa::SigningKey::random(&mut OsRng)`

**4. Persist private key**

- Create `~/.hardtrust/` directory if it does not exist (no error if it already exists)
- Write the private key to `~/.hardtrust/device.key`:
  - Format: raw 32-byte lowercase hex, no `0x` prefix, followed by a single newline
  - Example: `ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\n`
- Set file permissions to `0600`

**5. Derive address and print**

- Derive the Ethereum address using `public_key_to_address` from `hardtrust-types` (V1)
- Print to stdout:
  ```
  Serial: <serial>
  Address: 0x<address>
  ```

### `device/src/dev_config.rs`

- `DEV_SERIAL` and `DEV_ADDRESS` constants remain in place — do not remove them
- Add a comment above each: `// used only by scripts/e2e-the-wire.sh`

## What NOT to Build

- No `--force` flag logic — only the message mentioning it
- No changes to `device emit`
- No changes to the attester or contract
- No key loading / key reading from disk (that is a future story)
- No passphrase or key encryption

## Validation

```bash
just build                      # workspace compiles cleanly
just test                       # all tests pass
device init                     # prints real serial and address
device init                     # prints warning, exits 0, key unchanged
just e2e-the-wire               # still passes (uses dev_config.rs constants)
```

## Dependencies

- Depends on: S1b.1-V1 merged (`public_key_to_address` available in hardtrust-types)

## Handoff Prompt

```
Rewrite the device init subcommand to use real secp256k1 keys.

Read the spec at context/specs/s1b.1-v2-device-init.spec.md first.
V1 (feat/s1b.1-v1-key-generation) must be merged before starting this branch.

Output files:
- device/Cargo.toml (add k256, rand_core)
- device/src/main.rs (rewrite init subcommand)
- device/src/dev_config.rs (add comment to DEV_SERIAL and DEV_ADDRESS)

Respect the "What NOT to Build" section strictly.
After implementation, run the validation commands from the spec.
Branch: feat/s1b.1-v2-device-init
```
