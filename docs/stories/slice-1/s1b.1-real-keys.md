# S1b.1 — Generate a Real Device Identity

## User Story

As a Device Owner, I can run `device init` and get a real cryptographic identity derived from my hardware serial, so that I have a unique Ethereum address I can share with an Attester for registration.

## Context

S1a delivered a walking skeleton with hardcoded serial ("HARDCODED-001") and a hardcoded Ethereum address from dev_config.rs. S1b.1 replaces those placeholders with real secp256k1 cryptography: the hardware serial is read from /sys/firmware/devicetree/base/serial-number, a keypair is generated from it, and the private key is persisted to disk. Nothing else changes — device emit, attester, and contract are untouched.

This is a horizontal story that touches device/ and types/ (shared address derivation function).

## Acceptance Criteria

- [ ] Given a Raspberry Pi, when I run `device init` for the first time, then I see my device's serial number and a unique Ethereum address printed to the screen
- [ ] Given a dev or CI machine without hardware identity, when I run `device init` for the first time, then I still see a serial number and a unique Ethereum address, both clearly marked as emulated — serial and address are prefixed with `[EMULATED]`
- [ ] Given I have already run `device init`, when I run `device init` again, then I see a warning that my identity already exists and nothing changes
- [ ] Given any successful run of `device init`, when I later use the device, then my identity is available without re-generating it

## Out of Scope

- Data signing → S1b.2
- Attester/contract changes → not needed for this story
- Key rotation, passphrase → Release 2
- QR code output → Release 2

## Related ADRs

- ADR-0002: secp256k1 for device identity
- ADR-0006: Emulation mode for CI environments

## Definition of Done

- `device init` generates a real keypair and derives a real Ethereum address
- Running `device init` twice does not overwrite the existing key
- Address derivation has a unit test with a known test vector
- `just build` and `just test` pass
- `just e2e-the-wire` still passes (The Wire is unaffected — uses its own hardcoded config)
