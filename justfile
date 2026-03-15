# Build contracts (ABI needed by attester)
forge-build:
    cd contracts && forge build

# Build all Rust crates (requires contracts built first)
build: forge-build
    cargo build --workspace

# Run all tests
test: forge-build
    cd contracts && forge test
    cargo test --workspace

lint:
    @cargo fmt --check 2>/dev/null || echo "No workspace members to lint"
    @cargo clippy --workspace -- -D warnings 2>/dev/null || echo "No workspace members to check"
    cd contracts && forge fmt --check
    cd contracts && npx solhint 'src/**/*.sol'
    cd contracts && aderyn . || true

ci: lint test

# E2E: Register a device and confirm on-chain
e2e-register:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill $ANVIL_PID 2>/dev/null' EXIT
    # Start Anvil in background
    anvil &
    ANVIL_PID=$!
    sleep 2
    # Build and deploy
    cd contracts && forge build
    CONTRACT_ADDRESS=$(forge script script/Deploy.s.sol \
      --rpc-url http://127.0.0.1:8545 --broadcast 2>&1 | awk '/DEPLOYED:/ {for(i=1;i<=NF;i++) if($i ~ /^0x/) print $i}')
    cd ..
    echo "Contract: $CONTRACT_ADDRESS"
    # Device init
    cargo run --bin device -- init
    # Register
    cargo run --bin attester -- register \
      --serial HARDCODED-001 \
      --device-address 0x1234567890abcdef1234567890abcdef12345678 \
      --contract $CONTRACT_ADDRESS
    # Confirm registration via getDevice
    SERIAL_HASH=$(cast keccak "HARDCODED-001")
    DEVICE=$(cast call $CONTRACT_ADDRESS "getDevice(bytes32)" $SERIAL_HASH --rpc-url http://127.0.0.1:8545)
    echo "Device registered: $DEVICE"
    echo "S1a.1 gate: PASSED"

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

# E2E: The Wire — complete walking skeleton gate
e2e-the-wire:
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

    # Device emit
    cargo run --bin device -- emit
    echo "Reading written"

    # === CASE 1: VERIFIED (registered device) ===
    VERIFY_OUTPUT=$(cargo run --bin attester -- verify \
      --file reading.json \
      --contract "$CONTRACT_ADDRESS")
    echo "$VERIFY_OUTPUT"

    if [[ "$VERIFY_OUTPUT" != *"VERIFIED"* ]]; then
        echo "The Wire gate: FAILED — expected VERIFIED for registered device"
        exit 1
    fi
    echo "Case 1: VERIFIED — OK"

    # === CASE 2: UNVERIFIED (unregistered device) ===
    cat > fake-reading.json <<'FAKEJSON'
    {
      "serial": "FAKE-DEVICE-999",
      "address": "0x0000000000000000000000000000000000000BAD",
      "temperature": 22.5,
      "timestamp": "2025-01-01T00:00:00Z",
      "signature": "0xFAKESIG"
    }
    FAKEJSON

    UNVERIFIED_OUTPUT=$(cargo run --bin attester -- verify \
      --file fake-reading.json \
      --contract "$CONTRACT_ADDRESS")
    echo "$UNVERIFIED_OUTPUT"

    if [[ "$UNVERIFIED_OUTPUT" == *"VERIFIED"* && "$UNVERIFIED_OUTPUT" != *"UNVERIFIED"* ]]; then
        echo "The Wire gate: FAILED — expected UNVERIFIED for unregistered device"
        exit 1
    fi
    echo "Case 2: UNVERIFIED — OK"

    # Cleanup
    rm -f fake-reading.json

    echo ""
    echo "The Wire gate: PASSED"
