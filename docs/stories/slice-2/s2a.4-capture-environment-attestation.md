# S2a.4 — Capture Environment Attestation

## User Story

**As a** researcher reviewing TerraScope data,
**I want** each capture to include verifiable proof of the software environment that produced it,
**so that** I can confirm the data was captured by the official TerraGenesis pipeline and not a tampered script.

## Context

The current capture pipeline delegates image acquisition to an external bash script (`capture.sh`). This script could be replaced or modified, allowing someone to inject fabricated images that still produce valid signatures. Environment attestation adds a layer of evidence: the capture manifest includes hashes of the script and binary that produced it, plus hardware identifiers, so the attester can verify the pipeline was untampered.

## Acceptance Criteria

1. `capture.json` includes an `environment` object with:
   - `script_hash` — SHA-256 of the capture script that was executed
   - `binary_hash` — SHA-256 of the running `device` binary
   - `hw_serial` — hardware serial number of the RPi
   - `camera_info` — camera device identifier (from `v4l2-ctl` or `/proc/device-tree/model`)
2. The `environment` block is included in the signed payload (covered by the device signature)
3. `attester verify` checks `script_hash` and `binary_hash` against known-good values from the official release
4. Verification reports PASS/WARN/FAIL for environment integrity:
   - PASS: all hashes match official release
   - WARN: hardware detected but script/binary hash not in known set
   - FAIL: signature invalid (existing behavior)

## Out of Scope

- TEE / Secure Boot / TPM integration
- Preventing root-level tampering (detection only)
- Dynamic script loading from remote sources

## Notes

- This does NOT prevent a determined attacker with root access, but makes tampering **detectable and costly**
- The known-good hashes come from the GitHub release artifacts (already have SHA256SUMS)
- `hw_serial` is already available in the existing capture flow
