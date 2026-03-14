# ADR-0003: Alloy over ethers-rs for Rust-EVM Bindings

## Status
Accepted

## Context
The attester service and device components need to interact with EVM smart contracts from Rust. The two main Rust libraries for this are ethers-rs (legacy) and Alloy (its successor).

## Decision
Use Alloy for all Rust-to-EVM interactions. Alloy's `sol!` macro consumes Foundry-generated ABI artifacts directly, keeping contract bindings in sync without code generation steps.

## Consequences
- **Positive:** Actively maintained by the same team that builds Foundry. The `sol!` macro provides type-safe bindings at compile time. No separate codegen step needed.
- **Negative:** Alloy is newer and has less community content (tutorials, Stack Overflow answers) compared to ethers-rs.

## Alternatives Considered
- **ethers-rs:** Mature and well-documented, but maintenance has shifted to Alloy. Using ethers-rs would mean building on a library approaching end-of-life.
