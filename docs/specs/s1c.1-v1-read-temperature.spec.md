# Spec: S1c.1-V1 — read_temperature Function

## Parent Story

S1c.1 — Real Temperature

## Goal

Add a `read_temperature` function to `device/src/lib.rs` that reads the CPU temperature from sysfs, or returns a simulated varying value when the sensor file is unavailable. Pure function: takes the sensor file path as a parameter so it is fully testable without real hardware. Returns both the value and whether it was emulated.

## Tests First

Write these tests BEFORE implementing the function. All tests use temp files or non-existent paths — no real hardware dependency.

### Test 1: reads valid sysfs temperature

Create a temp file containing `42500\n` (millidegrees). Call `read_temperature(path)`. Assert the returned value is `42.5` and `is_emulated` is `false`.

### Test 2: reads temperature with trailing whitespace

Create a temp file containing `55000\n  ` (millidegrees with extra whitespace). Call `read_temperature(path)`. Assert the returned value is `55.0` and `is_emulated` is `false`.

### Test 3: falls back to emulation when file does not exist

Call `read_temperature("/tmp/nonexistent-hardtrust-sensor-test")`. Assert `is_emulated` is `true`. Assert the value is within the plausible range 30.0..=70.0.

### Test 4: falls back to emulation when file contains non-numeric content

Create a temp file containing `not-a-number\n`. Call `read_temperature(path)`. Assert `is_emulated` is `true`. Assert the value is within 30.0..=70.0.

### Test 5: falls back to emulation when file is empty

Create a temp file containing an empty string. Call `read_temperature(path)`. Assert `is_emulated` is `true`. Assert the value is within 30.0..=70.0.

### Test 6: emulated values vary across calls

Call `read_temperature("/tmp/nonexistent-hardtrust-sensor-test")` 10 times, collect all values. Assert not all values are identical (at least 2 distinct values). This validates AC: "simulated temperature value that varies between runs."

## What to Build

### `device/Cargo.toml`

Add dependency: `rand = "0.8"` (for simulated temperature generation)

### `device/src/lib.rs` — add `read_temperature`

#### Struct

```rust
pub struct TemperatureReading {
    pub celsius: f64,
    pub is_emulated: bool,
}
```

#### Function signature

```rust
pub fn read_temperature(sensor_path: &str) -> TemperatureReading
```

#### Behavior

1. Attempt to read the file at `sensor_path`
2. If the file is readable and contains a valid integer after trimming:
   - Divide by 1000.0 to convert millidegrees to Celsius
   - Return `TemperatureReading { celsius: value, is_emulated: false }`
3. If the file does not exist, is unreadable, is empty, or contains non-numeric content:
   - Generate a random f64 in the range 30.0..=70.0
   - Return `TemperatureReading { celsius: value, is_emulated: true }`

#### Default sensor path constant

```rust
pub const SYSFS_THERMAL_PATH: &str = "/sys/class/thermal/thermal_zone0/temp";
```

This constant is used by `main.rs` (V2) — the function itself takes the path as a parameter for testability.

## Output Files

| File | Change |
|------|--------|
| `device/Cargo.toml` | Add `rand` dependency |
| `device/src/lib.rs` | Add `TemperatureReading`, `SYSFS_THERMAL_PATH`, `read_temperature`, and tests |

## What NOT to Build

- No changes to `main.rs` (that is V2)
- No changes to protocol, attester, or contracts
- No logging or tracing
- No caching or periodic reads
- No external sensor support (GPIO, I2C, USB)

## Validation

```bash
cargo test -p device --lib    # all unit tests pass including read_temperature tests
cargo build -p device         # compiles cleanly
```

## Handoff Prompt

```
Add the read_temperature function to the device crate.

Read the spec at docs/specs/s1c.1-v1-read-temperature.spec.md first.

TDD: write the tests first (they should fail), then implement read_temperature
to make them pass.

Output files:
- device/Cargo.toml (add rand)
- device/src/lib.rs (add TemperatureReading, SYSFS_THERMAL_PATH, read_temperature, and tests)

Respect the "What NOT to Build" section strictly.
After implementation, run `cargo test -p device --lib` to validate.
Branch: feat/s1c.1-v1-read-temperature
```
