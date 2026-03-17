# S1c.1 — Real Temperature

## User Story

As a Device Owner, I can run `device emit` and it reads the actual CPU temperature from my hardware (or a realistic simulated value when hardware isn't available), so that my device's readings reflect real sensor data instead of a hardcoded placeholder.

## Context

S1a and S1b delivered the full signing and verification chain with a hardcoded temperature of 22.5. The signing function `create_signed_reading()` already accepts temperature as a parameter — the decoupling is done. This story replaces the hardcoded value with a real sensor read on Raspberry Pi hardware, and a simulated value on dev/CI machines where the sensor file does not exist. This follows the same emulation pattern established in S1b.1 for hardware serial numbers (ADR-0006). Nothing downstream changes — the reading flows through the existing signing and verification chain as before.

## Acceptance Criteria

- [ ] Given a Raspberry Pi with a CPU temperature sensor, when I run `device emit`, then the reading contains the actual CPU temperature of my device
- [ ] Given a dev or CI machine without a hardware temperature sensor, when I run `device emit`, then the reading contains a simulated temperature value that varies between runs — not a fixed constant
- [ ] Given a dev or CI machine, when I inspect the emitted reading, then there is a clear indication that the temperature is simulated (not from real hardware)
- [ ] Given any machine (RPi or emulated), when I run `device emit` multiple times, then each reading reflects the temperature at the time of emission — not a value decided once at startup
- [ ] Given a reading produced by `device emit` (real or simulated), when I run `attester verify`, then verification still succeeds for a registered device — the existing signing and verification chain is unaffected

## Edge Cases

- The sensor file exists but is unreadable (permissions) — fall back to emulation mode, do not crash
- The sensor file exists but contains unexpected content (empty, non-numeric) — fall back to emulation mode, do not crash
- Simulated temperature stays within a physically plausible range (e.g., 30–70°C) so that downstream consumers never see absurd values

## Dependencies

- S1b.2 must be complete (`device emit` produces signed readings with temperature as a parameter)
- S1b.3 must be complete (verification chain works end-to-end)

## Out of Scope

- External sensors (USB, GPIO, I2C) — CPU temperature only
- Temperature units or formatting in the reading — whatever unit the current reading uses stays the same
- Alerting or thresholds on temperature values
- Continuous emission (periodic reads) — that is S3.4
- Changes to attester, contracts, or verification logic

## Related ADRs

- ADR-0006: Emulation mode for CI environments
