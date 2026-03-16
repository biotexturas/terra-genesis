# S1b.3 — Verify a Reading Cryptographically

## User Story

As anyone, I can run `attester verify` on a reading and it recovers the signer address from the ECDSA signature, so that I can detect tampered readings even if the address field is correct.

## Context

S1a `attester verify` used `is_verified()`: compared `reading.address == on-chain address`. No crypto — a forged reading with the correct address field would pass.

S1b.3 replaces this with ecrecover: recover the signer from the signature, compare to the on-chain address. Any field change (temperature, timestamp, serial, address) produces a different message hash, so the recovered address no longer matches. This closes the forgery gap without changing the CLI interface or the contract.

This is a horizontal story — touches `attester/` and `types/` (for a pure `verify_reading` function). On-chain ecrecover in Solidity is deferred to S1c.

## Acceptance Criteria

- [ ] Given a valid reading.json from my registered device, when I run `attester verify --file reading.json --contract <addr>`, then I see **VERIFIED**
- [ ] Given a reading.json where I change the temperature value, when I run `attester verify`, then I see **UNVERIFIED** — the data has been tampered with
- [ ] Given a reading.json where I change the timestamp, when I run `attester verify`, then I see **UNVERIFIED** — the data has been tampered with
- [ ] Given a reading.json where I change the serial number, when I run `attester verify`, then I see **UNVERIFIED** — the data has been tampered with
- [ ] Given a reading.json where the device address field looks correct but the data was altered, when I run `attester verify`, then I still see **UNVERIFIED** — a correct-looking address is not enough if the data was tampered with
- [ ] Given a reading.json where the address field matches a registered device but the signature was produced by a different private key, when I run `attester verify`, then I see **UNVERIFIED**
- [ ] Given a reading.json with a broken or invented signature, when I run `attester verify`, then I see **UNVERIFIED** — not an error or crash
- [ ] Given a reading.json from a device that was never registered, when I run `attester verify`, then I see **UNVERIFIED**
- [ ] The output of verify is the same as before: **VERIFIED** or **UNVERIFIED** — nothing else changes for the user

## Out of Scope

- On-chain ecrecover in Solidity → S1c
- Contract changes → S1c
- New CLI arguments → not needed

## Related ADRs

- ADR-0007 (new): no Ethereum personal sign prefix — raw keccak256 prehash for device readings. Rationale: readings are machine-to-machine payloads, not user-facing wallet messages. Raw prehash gives the same security without the EIP-191 complexity, and is compatible with future on-chain ecrecover in S1c.

## Dependencies

- S1b.1 must be complete (real key generation exists)
- S1b.2 must be complete (real ECDSA signatures exist)
- Inherits contract dependency from S1a.1/S1a.2 — on-chain registry query is unchanged.

## Definition of Done

- `attester verify` uses ecrecover instead of address equality
- Tampered reading produces UNVERIFIED (unit tested)
- `verify_reading` function in `types/` is pure and unit-tested
- ADR-0007 written in `docs/adr/`
- `just build` and `just test` pass
- `just e2e-the-wire` still passes
