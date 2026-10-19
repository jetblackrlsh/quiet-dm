# Quiet DM 1.20 — release candidate review

Reviewed by Dot Nova, October 19, 2026. Initial agent-first open-source
narrative oracle release approved by the owner on October 19, 2026.

## Verified
- 60 Node tests pass, including all 48 inherited tests and 12 integrity
  regressions. CLI and generated classic browser engine share mechanics.
- Deterministic DOM smoke passes with jsdom 30.1.2: normal interactions,
  storage failures, corrupt backup recovery, and both boon-control states.
- Seven additional Life-mode days (8–14), 51 separate persisted commands,
  no command failures, and exact replay of every result/final save after
  final hardening. Original Day 7 save retained unchanged.
- No runtime dependencies or network requirement; MIT license retained.

## Boundaries to publish honestly
- Actual Chromium/Firefox/WebKit UI checks were not rerun in this review.
  DOM tests are not a substitute for those browser acceptance tests.
- Local CLI lock covers a single canonical local path, not symlink aliases,
  remote shared filesystem coordination, or multiple browser tabs.
- Forced termination can leave a lock: follow README recovery instructions.
- Receipts and journals grow with play. Large-history performance has not
  been characterized. Old already-evicted receipts cannot be recovered.
- Saved randomness is deterministic, not secret or tamper-proof. The
  checksum detects corruption, not a hostile author who recomputes it.
- Life-mode NPCs, relationships, inventory and consequences are maintained
  by the player/agent in the journal. They are not independently simulated.
- Upgraded saves should remain on 1.20+, preserving the original backup.

No blocking defect remained in the tested agent-first scope. This supports
an initial public release with these limitations documented, not a claim
of exhaustive correctness or all-browser certification. Keep personal life
saves and review evidence private unless their publication is separately
approved. The source package contains only the original shipped examples;
it does not include Dot's private Glassmere save or logs.
