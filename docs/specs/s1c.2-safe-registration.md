# S1c.2 — Safe Registration

## User Story

As an Attester, when I try to register a device that's already registered, the system rejects the operation with a clear error, so that I can't accidentally overwrite an existing device's registration.

## Context

The current `registerDevice()` contract function silently overwrites existing registrations. If an Attester accidentally calls `attester register` twice with the same serial but a different device address, the first registration vanishes without warning. This is a data integrity bug — a registered device can lose its on-chain identity with no trace.

Additionally, successful registrations emit no on-chain events, making the registration history unauditable.

This is a horizontal story: the contract rejects duplicate registrations and emits an event on success, and the attester CLI surfaces meaningful feedback in both cases.

## Acceptance Criteria

- [ ] Given a device serial that has never been registered, when I run `attester register`, then I see a confirmation that the device was registered successfully, including the transaction hash
- [ ] Given a device serial that has never been registered, when registration succeeds, then an on-chain event is emitted containing the serial hash and device address, so that the registration is auditable
- [ ] Given a device serial that is already registered, when I run `attester register` with the same serial, then the transaction is rejected and I see a clear error message indicating the device is already registered — not a raw revert string
- [ ] Given a device serial that is already registered, when the registration is rejected, then the existing registration remains unchanged — the original device address, attester, and timestamp are preserved exactly as they were
- [ ] Given two different device serials, when I register them both, then both succeed — the duplicate check is per serial, not global

## Edge Cases

- Same serial, same address: rejected. Even if the attester provides the exact same device address, re-registration is not allowed. The device is already registered.
- Raw revert on CLI: the attester CLI must catch the contract revert and display a human-readable message, not an opaque hex revert or Alloy error trace.

## Out of Scope

- Re-registration or address update for an existing device (deferred to R2)
- Device deactivation or revocation (deferred to R2)
- Multiple attesters (single ATTESTER for Slice 1)
- On-chain ecrecover or signature verification in the contract (deferred to Slice 2)

## Dependencies

- S1a.1 must be complete (contract exists and `registerDevice` works)
- S1b stories complete (real keys and real addresses are in use)
