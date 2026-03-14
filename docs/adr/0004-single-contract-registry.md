# ADR-0004: Single Contract for Registry and Attestation

## Status
Accepted

## Context
The on-chain component needs to handle two concerns: device registration (identity) and attestation storage (signed readings). These could be separate contracts or combined into one.

## Decision
Use a single smart contract that handles both device registration and attestation verification. The contract maintains a registry of authorized device addresses and accepts/verifies signed attestations from registered devices.

## Consequences
- **Positive:** Simpler deployment and interaction — one address, no cross-contract calls, lower gas for registration + attestation in the same transaction context.
- **Negative:** Larger single contract. If either concern grows significantly, it may need to be split later.

## Alternatives Considered
- **Separate Registry and Attestation contracts:** Cleaner separation of concerns, but adds cross-contract call complexity, higher gas costs, and deployment coordination — all unnecessary at MVP scale.
