# Spec: S1c.1-V2 — Device Emit Temperature Integration

## Parent Story

S1c.1 — Real Temperature

## Goal

Update `device emit` in `device/src/main.rs` to call `read_temperature` instead of using the hardcoded 22.5 value, and print an `[EMULATED]` tag when the temperature was simulated. The existing signing and verification chain is unaffected — only the temperature source changes.

## Tests First

Write or update these tests BEFORE changing the emit implementation.

### Test 1: emit produces reading with non-hardcoded temperature

Run `device emit`. Parse `reading.json`. Assert `reading.temperature` is NOT exactly 22.5 (the old hardcoded value). Assert `reading.temperature` is within 30.0..=70.0 (emulated range, since CI has no sysfs sensor).

### Test 2: emit prints EMULATED tag on dev/CI machines

Run `device emit`. Capture stdout. Assert stdout contains `[EMULATED]` (since CI/dev machines lack the sysfs thermal sensor).

### Test 3: emit reading is still verifiable

Run `device init`, then `device emit`. Load `reading.json`, load the device key, derive the address, call `verify_reading`. Assert verification succeeds. This ensures the signing chain is unbroken after replacing the temperature source.

### Test 4: consecutive emits produce different temperatures

Run `device emit` twice, parse both `reading.json` files. Best-effort check: with the random range 30.0..=70.0, two consecutive calls are overwhelmingly likely to differ. The stronger variation test is in V1 (unit level, 10 calls).

## What to Build

### `device/src/main.rs` — update `Command::Emit` handler

Replace the hardcoded `22.5` with:

1. Call `read_temperature(SYSFS_THERMAL_PATH)`
2. Use `temp_reading.celsius` as the temperature parameter to `create_signed_reading`
3. After writing `reading.json`, print:
   - If `temp_reading.is_emulated`: `Wrote reading.json [EMULATED temperature]`
   - If real sensor: `Wrote reading.json`

Update existing test assertion that checks for `22.5` to check the emulated range instead.

## Output Files

| File | Change |
|------|--------|
| `device/src/main.rs` | Update emit handler, update test assertion, add new tests |

## What NOT to Build

- No changes to `device/src/lib.rs` (done in V1)
- No changes to protocol, attester, or contracts
- No temperature formatting or unit conversion in output
- No `--real` / `--emulated` flags
- No changes to `reading.json` schema (temperature is still a plain f64)
- No continuous emission or periodic reads

## Dependencies

- S1c.1-V1 must be merged (`read_temperature`, `TemperatureReading`, `SYSFS_THERMAL_PATH` available)

## Validation

```bash
cargo test -p device             # all tests pass (unit + integration)
cargo build -p device            # compiles cleanly
just e2e-the-wire                # The Wire gate still passes
```

## Handoff Prompt

```
Wire read_temperature into device emit so it uses real CPU temp.

Read the spec at docs/specs/s1c.1-v2-device-emit-temp.spec.md first.
S1c.1-V1 must be merged before starting.

TDD: update the existing test assertion and write new tests first (they should fail),
then update the emit handler to make them pass.

Output files:
- device/src/main.rs (update emit handler, update and add tests)

Respect the "What NOT to Build" section strictly.
After implementation, run `cargo test -p device` and `just e2e-the-wire` to validate.
Branch: feat/s1c.1-v2-device-emit-temp
```
