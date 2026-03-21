# S2b.1-V1: On-Chain Capture Verification (View Function)

**Type:** Feature
**Story:** [S2b.1 On-Chain Capture Verification](../stories/slice-2/s2b.1-onchain-verify.md)
**Depends on:** S2a.1-V1 (protocol generic signing), existing HardTrustRegistry.sol
**ADR:** [ADR-0010 On-Chain Verification Model](adr-0010-onchain-verification-model.md)

---

## Problem

The attester verifies captures off-chain: it does `ecrecover` in Rust, then queries the contract for the device address. The verification result is ephemeral — you must trust whoever ran the attester. There is no way to verify a capture trustlessly.

## Security References

This spec follows best practices from:
- **ethskills.com/security** — ecrecover patterns, signature malleability, input validation, CEI pattern
- **ethskills.com/testing** — Foundry fuzz testing, `vm.sign` for test signatures, edge case coverage
- **ethskills.com/audit** — checklist for signature verification, access control, event emission

## What to Build

### Step 1 — Install OpenZeppelin Contracts

The contract needs OZ's `ECDSA.recover()` for safe signature verification. Install via Foundry:

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

Add to `remappings.txt`:
```
@openzeppelin/=lib/openzeppelin-contracts/
```

### Step 2 — Add `registeredDevices` reverse lookup to HardTrustRegistry.sol

The current contract maps `serialHash => Device` but has no way to check if an `address` is a registered device. Add a reverse lookup:

```solidity
mapping(address => bool) public registeredDevices;
```

Update `registerDevice()` to populate it:

```solidity
function registerDevice(bytes32 serialHash, address deviceAddr) external {
    if (msg.sender != ATTESTER) revert NotAttester();
    if (devices[serialHash].active) revert DeviceAlreadyRegistered(serialHash);
    devices[serialHash] =
        Device({deviceAddr: deviceAddr, attester: msg.sender, attestedAt: block.timestamp, active: true});
    registeredDevices[deviceAddr] = true;
    emit DeviceRegistered(serialHash, deviceAddr, msg.sender);
}
```

One extra SSTORE (~22,100 gas) per registration — one-time cost per device.

**Migration note:** Devices registered before this change won't have the reverse mapping. At testnet stage, redeployment is the migration path (redeploy contract and re-register devices). This is acceptable for hackathon.

### Step 3 — Add `verifyCapture` view function using OZ ECDSA

**CRITICAL: Use OpenZeppelin ECDSA, NOT raw ecrecover.** Raw ecrecover has known vulnerabilities:
- Does not reject s-value malleability (signature can be "flipped" to produce a different valid signature for the same hash)
- Does not validate v (must be 27 or 28)
- Returns address(0) silently on invalid input instead of reverting

OZ `ECDSA.recover()` handles all of these. Even though this is a view function, S2b.2 will build on it, and malleability in a stateful context could allow duplicate proof submissions.

```solidity
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Verify a device-signed capture on-chain. Free to call (view).
/// @param captureHash The keccak256 prehash that the device signed (from Signable::prehash()).
/// @param v Signature recovery id (27 or 28).
/// @param r Signature r component.
/// @param s Signature s component.
/// @return valid True if signer is a registered device.
/// @return signer The recovered address (address(0) if signature is invalid).
function verifyCapture(
    bytes32 captureHash,
    uint8 v,
    bytes32 r,
    bytes32 s
) external view returns (bool valid, address signer) {
    // OZ ECDSA.recover reverts on invalid signatures (bad v, malleable s, zero address)
    // Wrap in try/catch to return (false, address(0)) instead of reverting
    try this._recoverSigner(captureHash, v, r, s) returns (address recovered) {
        signer = recovered;
        valid = registeredDevices[signer];
    } catch {
        return (false, address(0));
    }
}

/// @dev Internal helper exposed via `this.call` for try/catch on view function.
function _recoverSigner(
    bytes32 hash,
    uint8 v,
    bytes32 r,
    bytes32 s
) external pure returns (address) {
    return ECDSA.recover(hash, v, r, s);
}
```

**Alternative (simpler, reverts on invalid sig):**

If reverts on invalid signatures are acceptable (the caller handles them), skip try/catch:

```solidity
function verifyCapture(
    bytes32 captureHash,
    uint8 v,
    bytes32 r,
    bytes32 s
) external view returns (bool valid, address signer) {
    signer = ECDSA.recover(captureHash, v, r, s);
    valid = registeredDevices[signer];
}
```

**Recommendation for hackathon:** Use the simpler version (reverts on invalid). The attester CLI can catch the revert and print UNVERIFIED. Fewer lines, same security.

Key points:
- `view` function — **no gas cost**, no state change, anyone can call
- Does NOT reconstruct the hash — receives the pre-computed prehash. The signature proves a device signed it (see ADR-0010)
- `ecrecover` is an EVM precompile (0x01), costs ~3,000 gas in computation (free for `view` calls)
- Returns `(true, signer)` for valid registered devices, `(false, signer)` for unregistered, reverts for invalid signatures

### Step 4 — Update attester CLI to use on-chain verification

Change the `verify` command in `attester/src/main.rs` to call the contract's `verifyCapture()` instead of doing ecrecover locally.

Current flow (off-chain verify):
```
1. Read capture.json
2. Extract serial → compute serialHash → call getDevice(serialHash) → get deviceAddr
3. Do ecrecover in Rust (verify_device_data) → compare with deviceAddr
```

New flow (on-chain verify):
```
1. Read capture.json
2. Compute prehash in Rust (Signable::prehash())
3. Extract signature components (v, r, s) from the hex signature
4. Call contract.verifyCapture(prehash, v, r, s) → get (valid, signer)
5. Print VERIFIED/UNVERIFIED based on result
```

The attester needs to:
1. Compute the prehash using `Signable::prehash()` (already exists in protocol)
2. Parse the signature into `(v, r, s)` components (use `alloy::primitives::Signature`)
3. Call `verifyCapture` as a view call (no wallet/private key needed for verification!)
4. For `Reading` type: keep using the current off-chain flow (on-chain verify is for captures only, readings can be added later)

**v-value derivation:** The Rust signing uses `sign_prehash_recoverable` which returns a `RecoveryId` (0 or 1). Convert to Ethereum v: `v = recovery_id + 27`. Do NOT use `unwrap_or(27)` — compute explicitly.

```rust
// Pseudocode for the new capture verification path
let prehash = capture.prehash().ok_or("invalid capture data")?;
let sig_bytes = hex::decode(capture.signature.trim_start_matches("0x"))?;
let alloy_sig = AlloySignature::from_raw(&sig_bytes)?;

// Explicit v derivation — do not unwrap_or
let v = alloy_sig.v().y_parity_byte_non_eip155()
    .ok_or("could not extract v from signature")?;
let r = alloy_sig.r();
let s = alloy_sig.s();

let result = registry.verifyCapture(
    prehash.into(),
    v,
    r.into(),
    s.into()
).call().await;

match result {
    Ok(res) if res.valid => {
        println!("VERIFIED (on-chain) — signer: {}", res.signer);
    }
    Ok(res) => {
        println!("UNVERIFIED — signer {} not registered", res.signer);
    }
    Err(_) => {
        println!("UNVERIFIED — invalid signature");
    }
}
```

**Important:** Verification no longer requires `HARDTRUST_PRIVATE_KEY` — it's a view call. Only registration needs a key.

### Step 5 — Update Alloy sol! binding

The `sol!` macro in `main.rs` reads the contract ABI from the compiled JSON. After adding `verifyCapture` to the Solidity contract and recompiling with `forge build`, the binding automatically includes the new function. No manual ABI changes needed.

### Step 6 — Shared test vector (CRITICAL)

**This is the most important test.** The Rust prehash and Solidity ecrecover MUST agree on the hash. Create a shared test vector:

Given fixed inputs:
- serial: `"TERRASCOPE-TEST-001"`
- address: `"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"` (Anvil account 0)
- timestamp: `"2026-01-01T00:00:00Z"` (unix: 1767225600)
- content_hash: `"sha256:0000000000000000000000000000000000000000000000000000000000000001"`
- environment.script_hash: `"sha256:aaaa"`
- environment.binary_hash: `"sha256:bbbb"`
- environment.hw_serial: `"TEST-HW"`
- environment.camera_info: `"mock"`

1. **Rust test:** Compute `prehash()` with these inputs → assert exact `bytes32` value
2. **Foundry test:** Sign that exact `bytes32` with a known key using `vm.sign()`, call `verifyCapture` → assert `(true, signer)`
3. **The bytes32 value MUST match between both tests**

This ensures the Rust side and Solidity side agree on what was signed.

---

## Prehash Compatibility

The Rust `Signable::prehash()` for Capture produces:

```
keccak256(
    keccak256(serial)           // 32 bytes
    || address_bytes            // 20 bytes
    || content_hash_bytes       // 32 bytes (decoded from "sha256:...")
    || timestamp_u64_be         // 8 bytes
    || script_hash_string_bytes // variable (raw UTF-8)
    || binary_hash_string_bytes // variable (raw UTF-8)
    || hw_serial_string_bytes   // variable (raw UTF-8)
    || camera_info_string_bytes // variable (raw UTF-8)
)
```

The contract does NOT reconstruct this — it receives the pre-computed 32-byte hash. The signing uses `sign_prehash_recoverable` (raw hash, NOT `eth_sign` prefixed). This is compatible with `ecrecover` / `ECDSA.recover()` in Solidity.

---

## Output format

```
$ attester verify --file capture.json --contract 0x5FbDB...
VERIFIED (on-chain)
Environment:
  script_hash:  sha256:aaa111... → MATCH
  binary_hash:  sha256:bbb222... → MATCH
  hw_serial:    10000000abcdef01
  camera_info:  mmal service 16.1
```

For unregistered device:
```
UNVERIFIED — signer 0x1234... not registered
```

For invalid signature:
```
UNVERIFIED — invalid signature
```

---

## Files

| File | Action |
|------|--------|
| `contracts/src/HardTrustRegistry.sol` | Import OZ ECDSA, add `registeredDevices` mapping, update `registerDevice()`, add `verifyCapture()` view function |
| `contracts/test/HardTrustRegistry.t.sol` | Add tests for `verifyCapture`, `registeredDevices`, shared test vector |
| `attester/src/main.rs` | Change capture verify flow to call contract `verifyCapture()` instead of local ecrecover |
| `foundry.toml` or `remappings.txt` | Add OZ remapping |
| `scripts/e2e-the-wire.sh` | Verify all 6 cases still pass (no script changes expected, but validate) |
| `contracts/script/Deploy.s.sol` | No changes expected (same contract, new function) |

## Tests (TDD — write first)

### Solidity tests (Foundry)

1. **verifyCapture with valid registered device** — register device, sign a hash with `vm.sign(devicePk, hash)`, call verifyCapture → returns (true, deviceAddr)
2. **verifyCapture with unregistered device** — sign with unknown key → returns (false, signerAddr)
3. **verifyCapture with invalid signature** — pass garbage v/r/s → reverts (OZ ECDSA)
4. **verifyCapture with tampered hash** — sign hash A, verify hash B → returns (false, wrongAddr)
5. **verifyCapture s-malleability rejected** — flip s-value to high-s → reverts (OZ ECDSA)
6. **registeredDevices populated on register** — after registerDevice, registeredDevices[addr] == true
7. **registeredDevices false for unregistered** — random address returns false
8. **Shared test vector** — sign the fixed test vector hash with known key, verify on-chain → (true, expectedAddr)
9. **Existing registration tests still pass** — no regressions

Use `vm.sign(privateKey, hash)` in Foundry to generate test signatures.

### Rust/E2E tests

10. **Shared test vector (Rust side)** — compute prehash with fixed inputs, assert exact bytes32 matches Foundry test
11. **Attester verify capture calls contract** — e2e: deploy, register, capture, verify → VERIFIED (on-chain)
12. **Attester verify capture unregistered** — e2e: deploy, capture (no register), verify → UNVERIFIED
13. **Attester verify reading still works** — readings use existing off-chain flow, no regression
14. **v-value derivation** — verify v is explicitly computed as recovery_id + 27, not defaulted

### Fuzz tests (ethskills best practice)

15. **Fuzz verifyCapture with random hashes** — `vm.sign` with random keys + random hashes, verify returns (false, signer) for unregistered signers — no reverts on valid signatures

## E2E Impact (`scripts/e2e-the-wire.sh`)

The e2e script has 6 cases. This spec changes the capture verify path, which impacts some cases:

| Case | Description | Impact | Action |
|------|-------------|--------|--------|
| 1 | Reading VERIFIED (registered) | None — readings keep off-chain flow | No change |
| 2 | Reading UNVERIFIED (fake) | None — readings keep off-chain flow | No change |
| 3 | Capture VERIFIED (registered) | **Output changes** from `VERIFIED` to `VERIFIED (on-chain)` | Update grep: `*"VERIFIED"*` still matches `"VERIFIED (on-chain)"` — **OK as-is** |
| 4 | Capture UNVERIFIED (fake sig) | **Behavior changes** — OZ ECDSA reverts on `"0xFAKESIG"` instead of ecrecover returning wrong addr. Attester must catch revert and print `UNVERIFIED` | Update attester error handling. Grep checks `*"UNVERIFIED"*` — still matches |
| 5 | Environment MATCH | None — environment check is independent of on-chain verify | No change |
| 6 | Environment MISMATCH | None — environment check is independent | No change |

### Key e2e changes needed:

1. **Case 4 fake capture**: The `"0xFAKESIG"` signature will fail to parse as valid hex before even reaching the contract. The attester must handle this gracefully:
   - If signature can't be parsed into `(v, r, s)` → print `UNVERIFIED — invalid signature` (no contract call needed)
   - If signature parses but contract reverts (OZ ECDSA) → catch and print `UNVERIFIED — invalid signature`

2. **Deploy script**: The contract now imports OZ, so `forge build` must resolve the OZ dependency. Ensure `forge install` runs before `forge build` in CI/e2e, or that `lib/openzeppelin-contracts` is committed.

3. **No changes to e2e script itself** — the grep patterns (`*"VERIFIED"*`, `*"UNVERIFIED"*`) are broad enough to match the new output format. But verify this after implementation.

## Validation Criteria

- [ ] OpenZeppelin ECDSA imported and used (not raw ecrecover)
- [ ] `forge test` passes with all new verifyCapture tests (including fuzz)
- [ ] Shared test vector: same bytes32 hash in Rust and Foundry tests
- [ ] `attester verify --file capture.json --contract 0x...` prints `VERIFIED (on-chain)` for registered device
- [ ] Verification does NOT require `HARDTRUST_PRIVATE_KEY` (view call only)
- [ ] `registeredDevices[addr]` returns true after `registerDevice()`
- [ ] Invalid signatures revert cleanly (OZ ECDSA), attester catches and prints UNVERIFIED
- [ ] s-malleability signatures rejected by OZ ECDSA
- [ ] v-value explicitly derived (recovery_id + 27), not defaulted
- [ ] Existing registration and reading verify tests pass (no regression)
- [ ] E2E Cases 1-6 all pass (`scripts/e2e-the-wire.sh`)
- [ ] Case 4 (fake sig) prints UNVERIFIED without panic or unhandled revert
- [ ] OZ dependency committed or installable (`forge install` in CI)
- [ ] `just ci` passes
