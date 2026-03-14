# ADR-0005: Hybrid Storage — On-chain Registration, Off-chain Data

## Status
Accepted

## Context
Devices produce frequent sensor readings that need to be attested. Storing every reading on-chain is cost-prohibitive, but device identity and attestation verification must be trustless.

## Decision
Store device registration and attestation verification on-chain. Store the actual sensor data readings off-chain. The on-chain contract records that a valid attestation was submitted (emitting events with content hashes), while the full data payload lives off-chain.

## Consequences
- **Positive:** Dramatically lower gas costs — high-frequency readings don't each require a transaction. On-chain events provide an immutable audit trail of attestation hashes.
- **Negative:** Off-chain data requires a separate storage solution and availability guarantees. Verifiers must fetch off-chain data and check it against on-chain hashes.

## Alternatives Considered
- **Fully on-chain storage:** Simplest trust model but prohibitively expensive for high-frequency sensor data. A single temperature reading every minute would cost hundreds of dollars per day on mainnet.
- **Fully off-chain:** Lowest cost but loses the trustless verification that blockchain provides for device identity.
