# S1-Debt-V4: Dev Config Extraction

**Type:** Refactor (tech debt)
**Story Reference:** N/A — tech debt cleanup before Slice 2
**Depends on:** S1-Debt-V3 (already merged)

---

## Problem

The attester binary (`attester/src/main.rs`) hardcodes a well-known Anvil private key and localhost RPC URL via `dev_config::DEV_PRIVATE_KEY` and `dev_config::DEV_RPC_URL`. If someone runs this binary against a testnet or mainnet, it uses a publicly known key as the attester signer — a security risk.

## What to Build

Replace hardcoded constants with environment variables. After this change, the attester binary is safe to point at any network.

---

### 1. Update `attester/src/main.rs`

#### Current code (lines 10, 78-87):

```rust
// line 10:
use hardtrust_protocol::{dev_config, Reading};

// lines 78-80 (inside Command::Register match arm):
let signer: PrivateKeySigner = dev_config::DEV_PRIVATE_KEY
    .parse()
    .map_err(|_| "invalid attester private key")?;

// lines 83-87 (inside Command::Register match arm):
let provider = ProviderBuilder::new().wallet(wallet).connect_http(
    dev_config::DEV_RPC_URL
        .parse()
        .map_err(|_| "invalid RPC URL")?,
);

// lines 121-125 (inside Command::Verify match arm):
let provider = ProviderBuilder::new().connect_http(
    dev_config::DEV_RPC_URL
        .parse()
        .map_err(|_| "invalid RPC URL")?,
);
```

#### Target code:

```rust
// line 10 — remove dev_config import:
use hardtrust_protocol::Reading;

// Add a helper function above run():
fn env_rpc_url() -> Result<url::Url, Box<dyn std::error::Error>> {
    let raw = std::env::var("HARDTRUST_RPC_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8545".to_string());
    raw.parse().map_err(|_| format!("invalid RPC URL: {raw}").into())
}

// lines 78-80 — replace with:
let private_key_hex = std::env::var("HARDTRUST_PRIVATE_KEY")
    .map_err(|_| "HARDTRUST_PRIVATE_KEY env var is required. Set it to the attester's hex-encoded private key.")?;
let signer: PrivateKeySigner = private_key_hex
    .parse()
    .map_err(|_| "invalid HARDTRUST_PRIVATE_KEY — must be a hex-encoded private key (e.g. 0x...)")?;

// lines 83-87 — replace with:
let provider = ProviderBuilder::new()
    .wallet(wallet)
    .connect_http(env_rpc_url()?);

// lines 121-125 — replace with:
let provider = ProviderBuilder::new().connect_http(env_rpc_url()?);
```

**Key behaviors:**
- `HARDTRUST_PRIVATE_KEY`: **Required** for `register` subcommand. Error message must say "HARDTRUST_PRIVATE_KEY env var is required".
- `HARDTRUST_RPC_URL`: **Optional**, defaults to `http://127.0.0.1:8545`. Used by both `register` and `verify`.
- `HARDTRUST_PRIVATE_KEY` is NOT needed for `verify` (verify is read-only, no signing).

**Note on `url` crate:** Check if `alloy`'s `connect_http` accepts a `&str` or `url::Url`. If it accepts `&str`, skip the Url parse and just pass the string directly. Adjust `env_rpc_url()` accordingly.

---

### 2. Delete `protocol/src/dev_config.rs`

After Wave 1 (V3 merged), this file contains only:

```rust
/// Dev-only constants for local development with Anvil.
pub const DEV_RPC_URL: &str = "http://127.0.0.1:8545";
pub const DEV_PRIVATE_KEY: &str =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
```

After this spec removes the last consumers:
1. Delete `protocol/src/dev_config.rs` entirely
2. In `protocol/src/lib.rs`: remove `pub mod dev_config;` line
3. Verify no other Rust file imports `dev_config` — grep for `dev_config` in `*.rs` files

---

### 3. Update `scripts/e2e-the-wire.sh`

The e2e script calls the attester binary on lines 30-33. After this change, it needs to export the env vars.

**Add these exports near the top (after `set -euo pipefail`, before any binary calls):**

```bash
# Attester configuration — Anvil account #1 (well-known dev key)
export HARDTRUST_RPC_URL="http://127.0.0.1:8545"
export HARDTRUST_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
```

Place them after line 8 (`sleep 2`) and before line 11 (`cd contracts && forge build`).

---

### 4. Update `justfile`

The justfile currently passes `DEV_SERIAL` and `DEV_ADDRESS` to the e2e script (line 31-34). After V3 removed those from dev_config.rs, verify they're still used by the script or remove from justfile too.

**Current justfile (lines 30-34):**
```
e2e-the-wire:
    @ATTESTER_ADDRESS={{anvil_attester_addr}} \
     DEV_SERIAL={{dev_serial}} \
     DEV_ADDRESS={{dev_address}} \
     bash scripts/e2e-the-wire.sh
```

**Check:** Does `e2e-the-wire.sh` still reference `$DEV_SERIAL` or `$DEV_ADDRESS`? After V3, likely not. If unused, simplify to:

```
e2e-the-wire:
    @ATTESTER_ADDRESS={{anvil_attester_addr}} \
     bash scripts/e2e-the-wire.sh
```

Also remove the `dev_serial` and `dev_address` variables from the justfile header (lines 4-5) if nothing else uses them.

---

### 5. Update `README.md`

Add a Configuration section (after Quick Start, before Architecture):

```markdown
## Configuration

The attester binary reads configuration from environment variables:

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `HARDTRUST_PRIVATE_KEY` | Yes (for `register`) | — | Attester signing key (hex-encoded, e.g. `0x...`) |
| `HARDTRUST_RPC_URL` | No | `http://127.0.0.1:8545` | Ethereum JSON-RPC endpoint |

For local development with Anvil, the e2e script sets these automatically.
```

---

### 6. Add test for missing env var error message

Add one test in `attester/src/main.rs` `mod tests`:

```rust
#[test]
fn register_without_private_key_env_shows_clear_error() {
    // Ensure the env var is NOT set for this test
    let output = ProcessCommand::new(attester_bin())
        .env_remove("HARDTRUST_PRIVATE_KEY")
        .args([
            "register",
            "--serial", "TEST-001",
            "--device-address", "0x0000000000000000000000000000000000000001",
            "--contract", "0x0000000000000000000000000000000000000001",
        ])
        .output()
        .expect("failed to run attester binary");

    assert!(!output.status.success());
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(
        stderr.contains("HARDTRUST_PRIVATE_KEY"),
        "expected error mentioning HARDTRUST_PRIVATE_KEY, got: {stderr}"
    );
}
```

---

## Files touched

| File | Change |
|------|--------|
| `attester/src/main.rs` | Replace dev_config imports with env var reads, add 1 test |
| `protocol/src/dev_config.rs` | **DELETE** |
| `protocol/src/lib.rs` | Remove `pub mod dev_config;` |
| `scripts/e2e-the-wire.sh` | Export HARDTRUST_PRIVATE_KEY and HARDTRUST_RPC_URL |
| `justfile` | Remove unused DEV_SERIAL/DEV_ADDRESS vars if unused |
| `README.md` | Add Configuration section |

## What NOT to Build

- Do not add CLI flags (`--rpc-url`, `--private-key`) — env vars are sufficient for v1
- Do not add `.env` file support or `dotenv` dependency
- Do not change the device binary (it doesn't use these configs)
- Do not change the contract or deploy script

## TDD Order

1. **Baseline:** Run `just e2e-the-wire` — confirm it passes before changes
2. **Test:** Write `register_without_private_key_env_shows_clear_error` test — it will pass trivially now (dev_config key used), but after refactor it validates the env var path
3. **Implement:** Replace dev_config usage in main.rs with env vars
4. **Delete:** Remove `protocol/src/dev_config.rs` and its `pub mod` declaration
5. **Update:** Add exports to `e2e-the-wire.sh`, clean justfile
6. **Update:** Add Configuration section to README.md
7. **Validate:** `just ci` passes, `just e2e-the-wire` passes, new test passes

## Validation Criteria

- [ ] `protocol/src/dev_config.rs` does not exist
- [ ] No `pub mod dev_config` in `protocol/src/lib.rs`
- [ ] No `dev_config::` imports in any non-test Rust code
- [ ] No hardcoded private key in `attester/src/main.rs`
- [ ] `HARDTRUST_PRIVATE_KEY` is required — attester `register` fails with clear message if unset
- [ ] `HARDTRUST_RPC_URL` defaults to localhost if unset
- [ ] `just e2e-the-wire` passes (script exports env vars)
- [ ] `just ci` passes
- [ ] New test `register_without_private_key_env_shows_clear_error` passes
- [ ] README has Configuration section documenting env vars
- [ ] `grep -r "dev_config" --include="*.rs" .` returns 0 results (excluding docs/)
