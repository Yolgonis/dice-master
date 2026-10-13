# Dice Master 0.7.0 — TDD Evidence

## Scope

This release turns the restored Dice Master bundle into a maintainable, reproducible source tree and adopts canonical Dice Master runtime names without breaking 0.6.x integrations.

## User journeys

- As a maintainer, I can edit focused source files and reproduce the Foundry bundle deterministically.
- As an integration author, I can use canonical `diceMaster*` flags.
- As an existing user, legacy `fumbleSwitch*` flags and the settings class alias continue to work during the 0.7.x transition.
- As a release owner, I can verify the manifest, package, runtime, tests, syntax, and coverage with repeatable commands.

## Task evidence

| Behavior | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| Reproducible source build | `b727fcb`; build script and 14-file source tree were absent | `c64679c`; 27/27 passed | `npm run build` reconstructs `dice-master.js` byte-for-byte from focused `src/` regions. |
| Legacy-safe runtime naming | `62008f1`; 3 intended failures exposed missing canonical fields and class | `6a0a68e`; 30/30 passed | New `diceMaster*` fields are canonical while legacy fields and class alias remain compatible. |
| 0.7.0 release integrity | `504e8e1`; version synchronization failed as intended | `05ea2ca`; 30/30 passed | Manifest, npm package, and generated runtime report the same 0.7.0 version. |

## Validation commands

```text
npm run build
npm test
npm run check
npm run test:coverage
```

Final results:

- Deterministic build: passed, 14 source files
- Full suite: 30 passed, 0 failed, 0 skipped
- Syntax check: passed
- Production bundle V8 function coverage: 126/153, 82.35%
- Coverage threshold: 80%

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Every runtime region has a maintainable source file | `tests/build.test.cjs` | Build integration | PASS |
| 2 | Source compilation reproduces the checked-in bundle exactly | `tests/build.test.cjs` | Build integration | PASS |
| 3 | Runtime writes canonical flags and mirrors legacy compatibility flags | `tests/dice-master.test.cjs` | Compatibility/integration | PASS |
| 4 | Dice So Nice accepts canonical-only roll flags | `tests/dice-master.test.cjs` | Integration | PASS |
| 5 | Settings registration uses the canonical class and preserves the legacy alias | `tests/dice-master.test.cjs` | Compatibility/unit | PASS |
| 6 | Socket, strategy, workflow, widget, and settings behavior remains characterized | `tests/dice-master.test.cjs` | Regression/integration | PASS |
| 7 | Manifest, package, runtime, localization, docs, and scripts form a coherent 0.7.0 release | `tests/package-integrity.test.cjs` | Package integration | PASS |

## Known gaps

- The widget is exercised through controlled component boundaries rather than a running Foundry browser session.
- Foundry and D&D5e private prototype hooks remain a compatibility risk and should be isolated behind adapters in a later release.
- Legacy `fumbleSwitch*` aliases remain intentionally present for 0.7.x and need a documented removal window before a future major release.
- Coverage currently measures V8 function coverage for the real bundle; line and branch thresholds are not yet enforced.

## Merge evidence

The RED and GREEN commits are reachable from the current branch. If squashed, retain this report in the final commit or pull request.
