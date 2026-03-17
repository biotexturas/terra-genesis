# Spec: S1c.2-V1 — Contract Hardening (Event + Duplicate Guard)

## Parent Story

S1c.2 — Safe Registration

## Goal

Harden `registerDevice` so it rejects duplicate serial hashes (revert with a custom error) and emits an event on successful registration. Pure Solidity changes with Forge tests. No Rust changes.

## Tests First

Write these Forge tests BEFORE modifying the contract.

### Test 1: `test_registerDevice_emitsEvent`

Register a new device. Assert `DeviceRegistered` event is emitted with correct `serialHash`, `deviceAddr`, and `attester` fields. Use `vm.expectEmit(true, true, true, true)`.

### Test 2: `test_duplicateRegistration_reverts`

Register a device, then attempt to register the same `serialHash` with a different `deviceAddr`. Expect revert with `DeviceAlreadyRegistered(serialHash)`.

### Test 3: `test_duplicateRegistration_sameAddress_reverts`

Register a device, then attempt to register the same `serialHash` with the SAME `deviceAddr`. Expect revert with `DeviceAlreadyRegistered(serialHash)`. (Edge case: same serial + same address is still rejected.)

### Test 4: `test_duplicateRegistration_preservesOriginal`

Register device A with serial X. Attempt to register device B with serial X (expect revert). Call `getDevice(serialX)` and assert the original device A data is unchanged.

### Test 5: `test_differentSerials_bothSucceed`

Register two devices with different serial hashes. Both succeed. `getDevice` returns correct data for each.

## What to Build

### Changes to `contracts/src/HardTrustRegistry.sol`

1. Custom error: `error DeviceAlreadyRegistered(bytes32 serialHash);`
2. Event: `event DeviceRegistered(bytes32 indexed serialHash, address indexed deviceAddr, address indexed attester);`
3. Duplicate guard in `registerDevice`: `if (devices[serialHash].active) revert DeviceAlreadyRegistered(serialHash);`
4. Emit event after storing: `emit DeviceRegistered(serialHash, deviceAddr, msg.sender);`

## Output Files

| File | Change |
|------|--------|
| `contracts/src/HardTrustRegistry.sol` | Add error, event, duplicate guard, emit |
| `contracts/test/HardTrustRegistry.t.sol` | Add 5 new tests |

## What NOT to Build

- No Rust code changes (that is V2)
- No changes to `Deploy.s.sol`
- No re-registration or update mechanism
- No deactivation or revocation
- No migration — Anvil state is ephemeral

## Validation

```bash
cd contracts && forge build && forge test -vvv
```

All existing tests must still pass. Five new tests must pass.

## Handoff Prompt

```
Harden the HardTrustRegistry contract with duplicate-registration protection and an event.

Read the spec at docs/specs/s1c.2-v1-contract-hardening.spec.md first.

TDD: write the five new test cases FIRST (they will fail), then modify the contract.

Changes to contracts/src/HardTrustRegistry.sol:
1. Add error DeviceAlreadyRegistered(bytes32 serialHash)
2. Add event DeviceRegistered(bytes32 indexed serialHash, address indexed deviceAddr, address indexed attester)
3. In registerDevice: add duplicate guard BEFORE the write
4. Emit DeviceRegistered after the write

After implementation, run: cd contracts && forge build && forge test -vvv
Branch: feat/s1c.2-v1-contract-hardening
```
