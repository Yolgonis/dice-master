# Dice Master 0.6.1 — TDD Evidence

## Source

No external plan file was supplied. The work follows the locally audited 0.6.0 module and the agreed `Security & Stability` release goal.

## User journeys

- As a player, I cannot publish a forged Better/Worse snapshot, so only the GM controls dice influence.
- As a player, I accept valid state synchronization from an active GM.
- As a GM, debug cards safely display user-controlled names and controller traces.
- As a maintainer, reinstalling runtime patches does not influence a die more than once.
- As a maintainer, the release has repeatable tests, syntax checks, documentation, and a real coverage threshold.

## Task evidence

| Behavior | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| Socket state authorization and debug HTML escaping | `be9387d`; 3 intended failures in a 12-test run | `8284808`; 12/12 passed | Non-GM and unauthenticated snapshots are rejected; active GM snapshots are accepted; debug markup escapes dynamic text. |
| Idempotent roll patch installation | `cf3372d`; Nudge was applied twice (`10 → 18`, expected `10 → 14`) | `399c755`; 13/13 passed | Reinstalling Die, modifier, and Roll wrappers does not duplicate influence. |
| 0.6.1 release integrity | `cc8c342`; version and release-file checks failed as intended | `4153f65`; 17/17 passed | Manifest/runtime versions match and required release files exist. |
| Repeatable coverage gate | `c1419c3`; coverage runner and package command were absent | `7962d4a`; coverage command passed | V8 function coverage for the dynamically executed production bundle must remain at or above 80%. |

## Validation commands

```text
npm test
npm run check
npm run test:coverage
```

Final results:

- Full suite: 25 passed, 0 failed, 0 skipped
- Syntax check: passed
- Production bundle V8 function coverage: 126/153, 82.35%
- Coverage threshold: 80%

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Player and unauthenticated socket snapshots cannot replace synchronized state | `tests/dice-master.test.cjs` | Security/integration | PASS |
| 2 | Active GM snapshots are accepted for their target client | `tests/dice-master.test.cjs` | Integration | PASS |
| 3 | User-controlled debug values cannot inject raw HTML tags | `tests/dice-master.test.cjs` | Security/unit | PASS |
| 4 | Runtime patches are idempotent | `tests/dice-master.test.cjs` | Lifecycle/integration | PASS |
| 5 | Full, Bias, Nudge, and Threshold strategies preserve semantic direction and die bounds | `tests/dice-master.test.cjs` | Unit | PASS |
| 6 | Advantage/disadvantage pending groups keep the correct result set | `tests/dice-master.test.cjs` | Unit/integration | PASS |
| 7 | D&D, Midi-QOL, Socketlib, raw socket, and Dice So Nice boundaries preserve controller identity | `tests/dice-master.test.cjs` | Integration | PASS |
| 8 | Widget state helpers and settings normalization remain consistent | `tests/dice-master.test.cjs` | Component boundary | PASS |
| 9 | Manifest, localization, documentation, and scripts form a coherent 0.6.1 release | `tests/package-integrity.test.cjs` | Package integration | PASS |

## Known gaps

- The widget is tested through controlled component boundaries, not a running Foundry browser session.
- Prototype integration still relies on Foundry/D&D5e internals; moving to modular source and a compatibility wrapper is the next planned release slice.
- Old `_fumbleSwitch...` runtime option names remain for compatibility and need a dual-read migration before removal.
- Coverage is precise V8 function coverage. Line and branch coverage should be introduced after the production bundle is restored to maintainable source modules.

## Merge evidence

The RED and GREEN commits are reachable from the current branch. If squashed, retain this report in the final commit or pull request.
