# Spec: S1a.2-V3 — E2E Verify

## Parent Story

S1a.2 — Verify Data from a Registered Device

## Goal

A just recipe that runs the full S1a.2 flow in one shot: deploy, init, register, emit, verify. Extends the S1a.1 chain with the new emit and verify steps.

## What to Build

### `justfile` updates

Add this recipe (do NOT modify existing `e2e-register`):

```just
# E2E: Emit a reading and verify it on-chain
e2e-verify:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill $ANVIL_PID 2>/dev/null' EXIT

    # Start Anvil
    anvil &
    ANVIL_PID=$!
    sleep 2

    # Build everything
    cd contracts && forge build && cd ..
    cargo build --workspace

    # Deploy contract
    DEPLOY_OUTPUT=$(cd contracts && forge script script/Deploy.s.sol \
      --rpc-url http://127.0.0.1:8545 --broadcast 2>&1)
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | awk '/DEPLOYED:/ {for(i=1;i<=NF;i++) if($i ~ /^0x/) print $i}')
    echo "Contract: $CONTRACT_ADDRESS"

    # Device init
    cargo run --bin device -- init

    # Register device
    cargo run --bin attester -- register \
      --serial HARDCODED-001 \
      --device-address 0x1234567890abcdef1234567890abcdef12345678 \
      --contract "$CONTRACT_ADDRESS"

    # Device emit (NEW in S1a.2)
    cargo run --bin device -- emit
    echo "Reading written"

    # Verify reading (NEW in S1a.2)
    VERIFY_OUTPUT=$(cargo run --bin attester -- verify \
      --file reading.json \
      --contract "$CONTRACT_ADDRESS")
    echo "$VERIFY_OUTPUT"

    # Assert VERIFIED
    if [[ "$VERIFY_OUTPUT" == *"VERIFIED"* ]]; then
        echo "S1a.2 gate: PASSED"
    else
        echo "S1a.2 gate: FAILED — expected VERIFIED"
        exit 1
    fi
```

### Output files

- Updated `justfile` (add `e2e-verify` recipe)

## What NOT to Build

- No CI integration for e2e (defer to S1c)
- No UNVERIFIED test in e2e (that's S1a.3)
- No modifications to existing `e2e-register` recipe (keep it as-is)
- No combined recipe that runs both `e2e-register` and `e2e-verify`

## Dependencies

- V1 (types crate + device emit) must be merged first
- V2 (attester verify) must be merged first
- All contracts must compile

## Validation

```bash
just e2e-verify
# Should complete with "S1a.2 gate: PASSED"
```

## Handoff Prompt

```
Add the e2e-verify recipe to validate the full S1a.2 flow.

Read the spec at docs/specs/s1a.2-v3-e2e-verify.spec.md first.
V1 (types + device emit) and V2 (attester verify) must be merged first.

Output files:
- Updated justfile (add e2e-verify recipe)

Respect the "What NOT to Build" section strictly.
After implementation, run `just e2e-verify` to validate.
Branch: feat/s1a.2-v3-e2e-verify
```
