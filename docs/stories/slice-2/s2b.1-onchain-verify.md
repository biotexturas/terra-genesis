# S2b.1 — On-Chain Capture Verification

## User Story

**As a** researcher,
**I want** to verify a capture against the blockchain directly,
**so that** the smart contract itself confirms the data was signed by a registered device — without trusting any intermediary.

## Context

Currently, the attester verifies captures off-chain: it does ecrecover locally and checks the device registry on-chain. The verification result is ephemeral — you have to trust whoever ran the attester.

By moving ecrecover into the smart contract as a view function, the blockchain itself becomes the verifier. The function is free to call (no gas, no tx), trustless, and permissionless.

## Acceptance Criteria

1. HardTrust.sol exposes a `verifyCapture(bytes32 captureHash, uint8 v, bytes32 r, bytes32 s)` view function
2. The function returns `(bool valid, address device)` — recovered signer and whether it's registered
3. HardTrust.sol has a `registeredDevices` reverse lookup mapping (`address => bool`), populated during `registerDevice()`
4. The attester CLI `verify` command calls the contract's `verifyCapture()` instead of doing ecrecover locally
5. Given a valid capture signed by a registered device → returns `(true, deviceAddress)`
6. Given a capture signed by an unregistered device → returns `(false, signerAddress)`
7. Given a tampered capture (signature mismatch) → returns `(false, address(0))` or wrong address
8. The function is a `view` — no gas cost, no state change, anyone can call

## Out of Scope

- On-chain persistence / proof-of-existence (S2b.2 — future)
- Submitting transactions to record proofs
- Historical query of verified captures

## Architecture Notes

See story map for key decisions:
- Model B (trustless, ecrecover in contract)
- Extend HardTrust.sol (not new contract)
- ADR-0010 pending

## Dependencies

- S2a.1-V1 (protocol generic signing — prehash is keccak256, EVM-compatible)
- Existing HardTrust.sol `registerDevice()` function
