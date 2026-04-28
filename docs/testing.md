# Test strategy

TDD-first. Three layers, run independently:

## Layer 1 — unit (vitest, no browser)

Fast, deterministic, run on every save. Cover all pure logic:

| Module        | What's tested                                                |
|---------------|--------------------------------------------------------------|
| `pace`        | jittered delay range, monotonicity, seeded determinism       |
| `archive`     | `tweets.js` parsing, malformed input, missing fields         |
| `filter`      | mode/age/regex/likes filters, AND-composition, edge cases    |
| `state`       | jsonl append, processed-set load/save, atomic writes         |
| `errors`      | classifier maps DOM/network signals → action enum            |
| `selectors`   | text-matcher helper for `[role="menuitem"]` fuzziness        |

Goal: 100% line coverage on these. They contain the load-bearing rules.

## Layer 2 — integration (vitest + Playwright, fixture HTML)

Spins up a real Chromium against `file://` fixtures that mirror x.com's DOM:
a tweet card, the menu, the confirmation modal. No network, no login, no
real account.

| Scenario                             | Fixture                          |
|--------------------------------------|----------------------------------|
| Click caret → menu opens             | `fixtures/tweet-card.html`       |
| Find "Delete" menuitem by text       | `fixtures/menu-open.html`        |
| Click confirm → success signal       | `fixtures/confirm-modal.html`    |
| Caret missing → error classified     | `fixtures/tweet-card-broken.html`|
| Login redirect detected              | `fixtures/login-redirect.html`   |

Fixtures are static HTML snapshots saved manually from x.com (selectors only,
no PII). Re-snapshot when selectors change. This is where regressions from X
UI changes will show up first.

## Layer 3 — e2e (manual / opt-in)

Real browser, real x.com, real test account. Gated behind
`X_CLEANER_E2E=1`. Not run in CI. The user runs these by hand against a
throwaway account before each release.

Single happy-path test: post a tweet via Playwright → run delete on it →
assert 404. Anything more risks tripping rate limits during testing.

## Conventions

- `*.test.ts` colocated under `test/`, mirroring `src/` paths.
- `describe()` per module, `it()` per behavior. Names read as sentences.
- Red-green-refactor strictly. No skipped or `.todo` tests in `main`.
- `vitest --watch` during dev. CI runs `npm test` (unit + integration).
- Fixtures and fakes live under `test/fixtures/` and `test/fakes/`.

## What we don't test

- Playwright internals (already tested upstream).
- Real X.com selectors via live network (covered by Layer 3 manually).
- Visual regressions. We assert behavior, not pixels.
