# S1b.2 — Emit a Cryptographically Signed Reading

## User Story

As a Device Owner, I can run `device emit` and it produces a reading signed with my device's real private key, so that anyone can cryptographically verify the reading came from my device.

## Context

Building on S1b.1 (real keypair generation), this slice replaces the `0xFAKESIG` placeholder in `reading.json` with a real 65-byte ECDSA signature. The signature is computed over a canonical payload — a deterministic encoding of the reading fields with no floating point and no JSON string signing. The `sign_reading` function is introduced in `types/` as shared logic. `attester verify` is not changed here — signature verification comes in S1b.3.

## Acceptance Criteria

- [ ] Given I have initialized my device (run `device init`), when I run `device emit`, then the reading file contains a real signature — not a placeholder like `0xFAKESIG`
- [ ] Given I have NOT initialized my device, when I run `device emit`, then I see a clear error message telling me to run `device init` first, and no reading file is created
- [ ] Given a reading file produced by `device emit`, when I inspect it, then the signature field looks like a real signature (not a short placeholder or empty string)

## Out of Scope

- Signature verification in attester → S1b.3
- Contract changes → S1b.3 / S1c
- Real temperature from hardware (still mocked) → S1c
- Error handling for malformed or missing reading files → S1c

## Dependencies

- S1b.1 must be complete (device.key exists, `public_key_to_address` available in types/)

## Related ADRs

- ADR-0002: secp256k1 for device identity
- ADR-0005: Hybrid storage (readings as JSON)

## Definition of Done

- `device emit` writes `reading.json` with a real ECDSA signature
- `sign_reading` function in `types/` is unit-tested with a known keypair
- `just build` and `just test` pass
- `just e2e-the-wire` still passes
