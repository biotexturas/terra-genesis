# S1c.3 — Graceful Failure

## User Story

As anyone running HardTrust commands, when I provide missing or corrupted inputs, I see a clear error message and the tool exits cleanly, so that I can diagnose what went wrong without seeing a crash or cryptic panic.

## Context

S1b introduced real cryptography and Result-based error handling infrastructure (S1b-R4). Some error paths already produce user-friendly messages — for example, `device emit` with a missing key file prints an error and exits 1. But many failure modes have not been audited: what does the user see when `attester verify` receives a missing or malformed reading.json? What happens when `device init` cannot create its data directory? What happens when `device emit` encounters a truncated key file?

This story is not about adding new features. It is about ensuring that every command in the CLI surface produces a clear, actionable error message on failure instead of a Rust panic, a cryptic library error, or a raw stack trace. The error handling infrastructure is already there — this story fills the gaps.

## Acceptance Criteria

- [ ] Given I run any HardTrust command with a required input file missing (key file, reading file), when the command fails, then I see a message that names the missing file and suggests what to do, and the process exits with a non-zero code
- [ ] Given I run any HardTrust command with a corrupted or malformed input file (truncated key, invalid JSON, garbled reading), when the command fails, then I see a message that names the file and says it could not be read or parsed — not a panic or raw library error
- [ ] Given I run `device init` and the data directory cannot be created (permissions, disk full), when the command fails, then I see a message explaining the directory could not be created
- [ ] Given I run `attester register` with an invalid device address format, when the command fails, then I see a message explaining the address is not valid
- [ ] Given any error scenario above, when the command fails, then it never prints a Rust panic, stack trace, or raw `unwrap` message to the terminal

## Edge Cases

- A reading file that is valid JSON but has missing required fields (e.g., no `signature` key) — should produce a clear "missing field" error, not a panic
- A key file that contains valid hex but the wrong number of bytes — should say the key is invalid, not crash on a slice index
- A zero-byte file where a key or reading is expected — should be treated as corrupted, not as an empty-but-valid input

## Out of Scope

- Network errors (RPC unreachable, contract call reverts) — separate story if needed
- Interactive prompts or recovery suggestions beyond "run X first" or "check your file"
- Retry logic or automatic recovery
- Logging or structured error output (JSON errors, log levels)
- Error codes or machine-parsable error format

## Dependencies

- S1b.1, S1b.2, S1b.3 must be complete (real crypto paths exist and error infrastructure is in place)
- No story depends on this one — it is a polish story
