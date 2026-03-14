# ADR-0001: Flat Monorepo Structure

## Status
Accepted

## Context
HardTrust spans multiple domains — embedded device code, an attestation service, smart contracts, and a web frontend. We needed to decide how to organize these components: separate repos, a nested monorepo, or a flat monorepo.

## Decision
Use a flat monorepo with top-level directories organized by responsibility: `device/`, `attester/`, `common/`, `contracts/`, and `webapp/`. Rust crates share a single Cargo workspace; Solidity lives under `contracts/` managed by Foundry.

## Consequences
- **Positive:** Single CI pipeline, atomic cross-component changes, shared Cargo workspace for dependency deduplication, and simplified code review.
- **Negative:** Repository grows larger over time. Contributors working on a single component still clone everything.

## Alternatives Considered
- **Separate repos per component:** Rejected because cross-component changes (e.g., shared types between `common/` and `contracts/`) would require coordinated multi-repo PRs.
- **Nested monorepo with deep hierarchy:** Rejected for unnecessary complexity at MVP stage.
