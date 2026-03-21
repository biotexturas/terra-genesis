# S2b-Debt-V1: Unify verifyCapture + verifyEnvironment into Single Function

**Type:** Refactor
**Story:** [S2b.1 On-Chain Capture Verification](../stories/slice-2/s2b.1-onchain-verify.md)
**Depends on:** S2b.1-V1 (verifyCapture), S2b.1-V2 (verifyEnvironment, setApprovedHashes)

---

## Problem

Verification is split across two separate contract functions (`verifyCapture` and `verifyEnvironment`), requiring two separate calls from the attester. A verifier should call ONE function that returns the complete verification result: signature validity, device registration, and environment match.

## What to Build

### Step 1 — Merge into single `verifyCapture` function in HardTrustRegistry.sol

Replace the current two functions with a single unified `verifyCapture`:

```solidity
/// @notice Verify a device-signed capture on-chain: signature + device registration + environment.
/// @param captureHash The keccak256 prehash that the device signed.
/// @param v Signature recovery id (27 or 28).
/// @param r Signature r component.
/// @param s Signature s component.
/// @param scriptHash SHA-256 of the capture script (bytes32). Pass bytes32(0) to skip env check.
/// @param binaryHash SHA-256 of the device binary (bytes32). Pass bytes32(0) to skip env check.
/// @return valid True if signer is a registered device.
/// @return signer The recovered address.
/// @return scriptMatch True if scriptHash matches approved (false if skipped or no approved hash set).
/// @return binaryMatch True if binaryHash matches approved (false if skipped or no approved hash set).
function verifyCapture(
    bytes32 captureHash,
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32 scriptHash,
    bytes32 binaryHash
) external view returns (
    bool valid,
    address signer,
    bool scriptMatch,
    bool binaryMatch
) {
    signer = ECDSA.recover(captureHash, v, r, s);
    valid = registeredDevices[signer];

    // Environment check — only if hashes provided and approved hashes are set
    if (scriptHash != bytes32(0) && approvedScriptHash != bytes32(0)) {
        scriptMatch = (scriptHash == approvedScriptHash);
    }
    if (binaryHash != bytes32(0) && approvedBinaryHash != bytes32(0)) {
        binaryMatch = (binaryHash == approvedBinaryHash);
    }
}
```

**Remove** the standalone `verifyEnvironment` function — its logic is now inside `verifyCapture`.

**Keep** `setApprovedHashes`, `approvedScriptHash`, `approvedBinaryHash` unchanged.

### Step 2 — Update attester CLI to single call

Current flow (two calls):
```
1. registry.verifyCapture(hash, v, r, s) → (valid, signer)
2. registry.verifyEnvironment(scriptHash, binaryHash) → (scriptMatch, binaryMatch)
```

New flow (one call):
```
1. registry.verifyCapture(hash, v, r, s, scriptHash, binaryHash) → (valid, signer, scriptMatch, binaryMatch)
```

In `attester/src/main.rs`, the capture verification path should:
1. Compute prehash + extract (v, r, s) (existing logic)
2. Convert `environment.script_hash` and `environment.binary_hash` to bytes32 (existing `parse_sha256_to_bytes32`)
3. Make ONE call to `verifyCapture` with all 6 parameters
4. Print unified output:

```
VERIFIED (on-chain) — signer: 0x1234...
Environment:
  script_hash:  sha256:aaa111... → MATCH (on-chain)
  binary_hash:  sha256:bbb222... → MATCH (on-chain)
  hw_serial:    10000000abcdef01
  camera_info:  mmal service 16.1
```

**Fallback logic** stays the same: if on-chain env returns (false, false) and no approved hashes are set (both zero on-chain), fall back to embedded/file-based check with "(embedded)" tag.

To detect "no approved hashes set": check `approvedScriptHash` and `approvedBinaryHash` are zero. This can be done by reading the public getters before calling verifyCapture, OR by interpreting (false, false) + checking if approved hashes are zero. Simplest: if both scriptMatch and binaryMatch are false, check `approvedScriptHash()` — if zero, fall back to embedded.

### Step 3 — Update e2e and Foundry tests

**Foundry tests:** Update all `verifyCapture` calls to use the new 6-parameter signature. Remove `verifyEnvironment` tests and merge their logic into `verifyCapture` tests:

1. **verifyCapture full — valid device + matching env** → (true, addr, true, true)
2. **verifyCapture — valid device, skip env (zeros)** → (true, addr, false, false)
3. **verifyCapture — valid device, mismatched env** → (true, addr, false, true) or variants
4. **verifyCapture — unregistered device** → (false, addr, -, -)
5. **verifyCapture — invalid signature** → reverts (OZ ECDSA)
6. **verifyCapture — no approved hashes set** → (true, addr, false, false) even with valid env hashes passed
7. **Existing registration tests unchanged**

**E2E:** Cases 1-6 should all pass. The script doesn't call contract functions directly — it calls the attester CLI which now makes one call instead of two. Output format stays compatible.

---

## Files

| File | Action |
|------|--------|
| `contracts/src/HardTrustRegistry.sol` | Merge verifyEnvironment into verifyCapture (new signature with 6 params), remove standalone verifyEnvironment |
| `contracts/test/HardTrustRegistry.t.sol` | Update verifyCapture tests to 6-param, remove verifyEnvironment tests, add unified test cases |
| `attester/src/main.rs` | Single verifyCapture call with env hashes, simplify the verify flow |

## Tests (TDD — write first)

1. **Unified verify: valid device + matching env** → (true, signer, true, true)
2. **Unified verify: valid device + env skipped (zeros)** → (true, signer, false, false)
3. **Unified verify: valid device + env mismatch** → (true, signer, false, false) with wrong hashes
4. **Unified verify: unregistered device** → (false, signer, -, -)
5. **Unified verify: invalid sig** → reverts
6. **Unified verify: no approved hashes on-chain** → env always false regardless of input
7. **E2E Cases 1-6 pass**
8. **No regressions on registration tests**

## Validation Criteria

- [ ] `verifyEnvironment` function removed from contract
- [ ] `verifyCapture` accepts 6 parameters and returns 4 values
- [ ] Attester makes ONE contract call for full capture verification
- [ ] Output format unchanged (VERIFIED/UNVERIFIED + environment MATCH/MISMATCH)
- [ ] Fallback to embedded hashes when no on-chain approved hashes set
- [ ] `forge test` passes
- [ ] E2E Cases 1-6 pass
- [ ] `just ci` passes
