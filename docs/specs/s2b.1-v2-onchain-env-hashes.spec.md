# S2b.1-V2: On-Chain Environment Hashes (Approved Release Registry)

**Type:** Enhancement
**Story:** [S2b.1 On-Chain Capture Verification](../stories/slice-2/s2b.1-onchain-verify.md)
**Depends on:** S2b.1-V1 (on-chain verifyCapture), S2a.4-V1 (environment attestation)

---

## Problem

The `verifyCapture` view function validates that a registered device signed the capture, but the environment verification (script_hash, binary_hash matching official release) is still done off-chain by the attester using embedded SHA256SUMS. Anyone can see the capture.json environment fields, but there's no on-chain source of truth for "which hashes are official."

## What to Build

### Step 1 — Add approved environment hashes to HardTrustRegistry.sol

Store the official release hashes on-chain. The attester (admin) sets them per release:

```solidity
bytes32 public approvedScriptHash;
bytes32 public approvedBinaryHash;

event EnvironmentHashesUpdated(bytes32 scriptHash, bytes32 binaryHash);

/// @notice Update the approved environment hashes for the current release.
/// @param scriptHash SHA-256 of the official capture script (as bytes32).
/// @param binaryHash SHA-256 of the official device binary (as bytes32).
function setApprovedHashes(bytes32 scriptHash, bytes32 binaryHash) external {
    if (msg.sender != ATTESTER) revert NotAttester();
    approvedScriptHash = scriptHash;
    approvedBinaryHash = binaryHash;
    emit EnvironmentHashesUpdated(scriptHash, binaryHash);
}
```

### Step 2 — Add `verifyEnvironment` view function

A simple view that checks if given hashes match the approved ones:

```solidity
/// @notice Check if environment hashes match the approved release.
/// @param scriptHash The script_hash from capture.json environment.
/// @param binaryHash The binary_hash from capture.json environment.
/// @return scriptMatch True if script hash matches approved.
/// @return binaryMatch True if binary hash matches approved.
function verifyEnvironment(
    bytes32 scriptHash,
    bytes32 binaryHash
) external view returns (bool scriptMatch, bool binaryMatch) {
    scriptMatch = (scriptHash == approvedScriptHash);
    binaryMatch = (binaryHash == approvedBinaryHash);
}
```

### Step 3 — Hash encoding convention

The capture.json stores hashes as strings: `"sha256:abc123..."`. The contract stores them as `bytes32`. Convention:

- Strip `"sha256:"` prefix
- Decode hex → 32 bytes
- Store as `bytes32`

Example: `"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"` → `0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

The attester CLI handles this conversion when calling `setApprovedHashes` and `verifyEnvironment`.

### Step 4 — Update attester CLI

#### New command: `set-release-hashes`

```rust
SetReleaseHashes {
    /// SHA-256 hash of the official capture script (hex, with or without sha256: prefix)
    #[arg(long)]
    script_hash: String,
    /// SHA-256 hash of the official device binary (hex, with or without sha256: prefix)
    #[arg(long)]
    binary_hash: String,
    /// Deployed contract address
    #[arg(long)]
    contract: Address,
}
```

This calls `setApprovedHashes()` on-chain. Requires `HARDTRUST_PRIVATE_KEY` (attester key).

#### Update `verify` command

After the existing signature verification and off-chain environment check, add on-chain environment check:

```
Signature:   VERIFIED (on-chain)
Environment:
  script_hash:  sha256:aaa111... → MATCH (on-chain)
  binary_hash:  sha256:bbb222... → MATCH (on-chain)
  hw_serial:    10000000abcdef01
  camera_info:  mmal service 16.1
```

If no approved hashes are set on-chain (both zero), fall back to embedded hashes check with a note:

```
  script_hash:  sha256:aaa111... → MATCH (embedded)
```

### Step 5 — Register hashes in e2e flow

In `scripts/e2e-the-wire.sh`, after deploying the contract and before verification, register the approved hashes:

```bash
# Compute official hashes
SCRIPT_SHA256=$(sha256sum ./scripts/mock-capture.sh | awk '{print $1}')
BINARY_SHA256=$(sha256sum ./target/debug/device | awk '{print $1}')

# Register on-chain
cargo run --bin attester -- set-release-hashes \
  --script-hash "$SCRIPT_SHA256" \
  --binary-hash "$BINARY_SHA256" \
  --contract "$CONTRACT_ADDRESS"
```

---

## Output format

With approved hashes set on-chain:
```
$ attester verify --file capture.json --contract 0x5FbDB...
VERIFIED (on-chain)
Environment:
  script_hash:  sha256:aaa111... → MATCH (on-chain)
  binary_hash:  sha256:bbb222... → MATCH (on-chain)
  hw_serial:    10000000abcdef01
  camera_info:  mmal service 16.1
```

With mismatched hashes:
```
  script_hash:  sha256:aaa111... → MISMATCH (on-chain expected sha256:xxx...)
```

No approved hashes on-chain (fallback):
```
  script_hash:  sha256:aaa111... → MATCH (embedded)
```

---

## Files

| File | Action |
|------|--------|
| `contracts/src/HardTrustRegistry.sol` | Add `approvedScriptHash`, `approvedBinaryHash`, `setApprovedHashes()`, `verifyEnvironment()` |
| `contracts/test/HardTrustRegistry.t.sol` | Tests for setApprovedHashes, verifyEnvironment |
| `attester/src/main.rs` | Add `set-release-hashes` command, update verify to check on-chain env hashes |
| `scripts/e2e-the-wire.sh` | Add set-release-hashes step, update Case 5/6 to verify on-chain matching |

## Tests (TDD — write first)

### Solidity tests (Foundry)

1. **setApprovedHashes by attester** — sets values, event emitted, readable via public getters
2. **setApprovedHashes by non-attester** — reverts NotAttester
3. **verifyEnvironment match** — both hashes match → (true, true)
4. **verifyEnvironment script mismatch** — wrong script → (false, true)
5. **verifyEnvironment binary mismatch** — wrong binary → (true, false)
6. **verifyEnvironment no hashes set** — both zero → (false, false)
7. **verifyEnvironment after update** — update hashes, old ones no longer match, new ones do
8. **Existing verifyCapture and registration tests still pass**

### Rust/E2E tests

9. **set-release-hashes CLI** — calls contract, hashes readable on-chain
10. **verify shows MATCH (on-chain)** — with approved hashes set, capture env matches
11. **verify shows MISMATCH (on-chain)** — with wrong approved hashes, shows MISMATCH
12. **verify fallback to embedded** — no on-chain hashes set, falls back with "(embedded)" note
13. **E2E Cases 1-6 still pass** — update Case 5 to use on-chain hashes, verify MATCH (on-chain)

## Validation Criteria

- [ ] `setApprovedHashes` only callable by ATTESTER
- [ ] `verifyEnvironment` returns correct match/mismatch for both fields
- [ ] `attester set-release-hashes` command works and sets on-chain values
- [ ] `attester verify` shows `MATCH (on-chain)` when hashes match approved
- [ ] `attester verify` shows `MISMATCH (on-chain)` when hashes differ
- [ ] Fallback to embedded hashes when no on-chain hashes set
- [ ] E2E Cases 1-6 all pass
- [ ] `just ci` passes

## Future Enhancement (Opción B)

For full trustless environment verification, restructure the prehash into two levels:
```
dataHash = keccak256(serial_hash || address || content_hash || timestamp)
envHash  = keccak256(script_hash || binary_hash || hw_serial || camera_info)
captureHash = keccak256(dataHash || envHash)
```
This would allow the contract to cryptographically prove that the environment fields are part of what the device signed. Deferred — requires protocol-level breaking change.
