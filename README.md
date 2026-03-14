# HardTrust

DePIN device identity and attestation system.

HardTrust enables physical devices (starting with Raspberry Pi) to cryptographically prove their identity and attest sensor readings on-chain. Devices sign data with secp256k1 keys, and an EVM smart contract verifies those signatures — creating a trustless bridge between hardware and blockchain.

## Architecture Overview

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│   Device     │       │   Attester   │       │   Smart Contract │
│  (RPi +      │──────▶│   Service    │──────▶│   (EVM)          │
│   Sensors)   │ signed│              │  tx   │                  │
│              │ data  │              │       │  - Registry      │
│  secp256k1   │       │  Alloy/RPC   │       │  - Attestation   │
└──────────────┘       └──────────────┘       └──────────────────┘
                                                      │
                                              ┌───────▼────────┐
                                              │    Webapp       │
                                              │  (Dashboard)    │
                                              └────────────────┘
```

**Key design decisions:**

- **secp256k1/ECDSA** for device identity — EVM-native verification via `ecrecover`
- **Hybrid storage** — device registration on-chain, sensor data off-chain
- **Single registry contract** — handles both identity and attestation for MVP simplicity
- **Alloy** for Rust-to-EVM bindings (successor to ethers-rs)
- **Emulation mode** — full pipeline testing without physical hardware

See [docs/adr/](docs/adr/) for detailed rationale on each decision.

## Repository Structure

```
hardtrust/
├── contracts/          # Solidity smart contracts (Foundry)
├── docs/
│   ├── adr/            # Architecture Decision Records
│   ├── specs/          # Feature specifications
│   └── stories/        # User stories
├── Cargo.toml          # Rust workspace (members added as crates are created)
├── justfile            # Task runner (just ci, just test, just lint)
├── CLAUDE.md           # AI-assisted development rules
└── REVIEW.md           # Code review criteria
```

Planned crates (not yet created):

- `device/` — Sensor reading, signing, serial communication
- `attester/` — Attestation service, EVM transaction submission
- `common/` — Shared types and crypto utilities
- `webapp/` — Dashboard for viewing device status and attestations

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Foundry](https://getfoundry.sh/) (forge, cast)
- [just](https://github.com/casey/just) (task runner)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/elmol/hardtrust.git
cd hardtrust

# Run CI locally
just ci

# Build contracts
cd contracts && forge build

# Run contract tests
cd contracts && forge test
```

## Development Workflow

This project uses an AI-assisted writer-reviewer workflow:

1. Read the spec in `docs/specs/` before implementing
2. One story per branch, one PR per story
3. Run `just ci` before opening a PR
4. All PRs require CI pass + human approval before merge
5. Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`

For development without a Raspberry Pi, use emulation mode:

```bash
HARDTRUST_EMULATE=1 cargo run  # or --emulate flag
```

## CI

GitHub Actions runs on every push and PR to `main`:

| Job | What it checks |
|-----|----------------|
| **lint** | `cargo fmt`, `cargo clippy`, `forge fmt` |
| **test** | `cargo test`, `forge test` |
| **integration** | Stub — enabled when contracts are deployed |
| **e2e** | Stub — enabled when full flow exists |

## License

TBD
