# ADR-0006: Emulation Mode for CI Without Physical Hardware

## Status
Accepted

## Context
The device component reads from physical sensors (e.g., temperature via serial) on a Raspberry Pi. CI environments and most developer machines don't have this hardware, but we still need to test the full signing and attestation pipeline.

## Decision
Support an emulation mode activated by `--emulate` flag or `HARDTRUST_EMULATE=1` environment variable. In emulation mode, the device component generates simulated serial input and synthetic temperature readings while using the same secp256k1 signing logic as production.

## Consequences
- **Positive:** CI can run the full pipeline without hardware. Developers can work without a physical RPi. The signing and attestation logic is tested identically in both modes.
- **Negative:** Emulated readings don't exercise real serial communication or hardware failure modes. Hardware-specific bugs can only be caught on actual devices.

## Alternatives Considered
- **Hardware-in-the-loop CI:** Most accurate but requires dedicated RPi runners, adding infrastructure cost and flakiness from hardware issues.
- **Mocking at the trait level:** Would test less of the real code path. Emulation at the data-source level keeps more production code under test.
