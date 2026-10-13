# Dice Master Attribution Cleanup — TDD Evidence

## Source and journey

This change was derived from the approved request to identify `Yolgonis` as the Dice Master manifest maintainer. The upstream MIT copyright notice remains legally required in `LICENSE`; manifest metadata and license attribution are intentionally separate.

As the module maintainer, I want Foundry to display the current maintainer identity while the distributed license preserves both the upstream copyright holder and current contributors.

## RED evidence

- Command: `node --test tests/package-integrity.test.cjs`
- Result before the manifest change: **FAIL** — 5 passed, 1 failed.
- Intended failure: the manifest author object was `{ "name": "taral" }` instead of `{ "name": "Yolgonis" }`.

## GREEN evidence

- Command: `node --test tests/package-integrity.test.cjs`
- Result after the manifest and license changes: **PASS** — 6 passed, 0 failed.
- Command: `npm test`
- Result: **PASS** — 32 passed, 0 failed.
- Command: `npm run check`
- Result: **PASS**.
- Command: `npm run test:coverage`
- Result: **PASS** — Dice Master V8 function coverage 126/153 (82.35%), above the configured 80% threshold.

## Guarantees

| What is guaranteed | Test | Type | Result |
|---|---|---|---|
| The manifest declares exactly one author named `Yolgonis`, with no email field | `tests/package-integrity.test.cjs` | Package integration | PASS |
| Upstream contact details are absent from the Foundry manifest | `tests/package-integrity.test.cjs` | Package integration | PASS |
| The exact upstream copyright notice and the current contributor notice remain in `LICENSE` | `tests/package-integrity.test.cjs` | License compliance | PASS |
| Runtime behavior and legacy `fumbleSwitch*` compatibility remain intact | `npm test` | Regression | PASS |
| Runtime JavaScript remains syntactically valid | `npm run check` | Static validation | PASS |

## Known gaps

No Foundry UI smoke test was necessary because these changes affect only manifest metadata and license text. The directory is not a Git repository, so no RED/GREEN checkpoint commits were created.
