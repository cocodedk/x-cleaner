# x-cleaner

Delete your own X.com replies, slowly. Local tool, your browser, your account.
No API tokens, no third-party server, no password automation.

Pacing target: **~6 deletes / minute** with jittered timing and long breaks.
Designed to keep one residential IP and one logged-in profile believable to
X's automation defenses.

## Website

- [English](https://cocodedk.github.io/x-cleaner/)
- [فارسی (Persian)](https://cocodedk.github.io/x-cleaner/fa/)

## Status

v1 covers replies only (the most common cleanup case). Originals, reposts,
and likes are deferred — the modules exist and are tested, just not wired
into the CLI yet.

## What's in the box

```
src/
  pace.ts          jittered delays, seeded RNG, long-break logic
  scheduler.ts     hourly/daily caps + abort-on-anomaly
  errors.ts        signal → action classifier (continue/retry/backoff/abort)
  state.ts         jsonl log + processed-set + atomic flush
  archive.ts       Twitter-archive parser (deferred input source)
  filter.ts        mode/age/likes/regex filtering (deferred)
  selectors.ts     central DOM selector constants
  replyDetector.ts identify reply cards on /with_replies
  scrape.ts        virtualization-aware scroll & enumerate
  delete.ts        caret → Delete → confirm
  diagnose.ts      screenshot + DOM + a11y dump on error
  browser.ts       persistent-profile Chromium launcher
  runner.ts        glues scheduler + queue + delete + state + diagnose
  cli.ts           login | probe | run subcommands
test/              66 tests across pure-logic + Playwright-fixture-HTML
docs/              PLAN.md, architecture.md, selectors.md, rate-limits.md,
                   research.md, testing.md
```

## Install

```sh
npm install
npx playwright install chromium
```

Requires Node 20+.

## First-time login

```sh
npm run login
```

This opens Chromium against `x.com/i/flow/login`. Sign in **manually** in the
browser window. Cookies and localStorage land in `./.profile/`. Press
`Ctrl-C` in the terminal when you're back on `x.com/home`.

Verify the saved login is still good:

```sh
npm run probe
```

## Dry run

```sh
npm run run:cleaner -- --handle=<your-handle> --dry-run --max=20
```

Prints which reply ids it would delete. No clicks happen.

## Real run

```sh
npm run run:cleaner -- --handle=<your-handle> --max=50
```

Watch the visible Chromium window. Hit `Ctrl-C` to stop at any point — state
is flushed after every action, so resume is just running the same command
again (already-processed ids are skipped).

End of run prints a summary; `state/log.jsonl` has the per-action history.

## When something goes wrong

On any error the runner saves a diagnostic bundle to
`state/diagnostics/<ts>-<reason>/`:

- `screenshot.png` — full-page capture
- `page.html` — full DOM at the moment of failure
- `article.html` — outerHTML of the targeted tweet card (if any)
- `snapshot.txt` — accessibility tree
- `meta.json` — reason, URL, timestamps

Open the bundle, find the selector that broke, update `src/selectors.ts`
and `test/fixtures/with-replies.html`, re-run tests, then resume.

## Tests

```sh
npm test         # full suite (unit + Playwright fixture-HTML)
npm run typecheck
```

Three layers (see `docs/testing.md`):

1. **Unit** — pure-logic modules.
2. **Integration** — Playwright against static fixture HTML files. No network.
3. **E2E** — gated behind `X_CLEANER_E2E=1`, run by hand against a throwaway
   account. Not wired up in v1.

## Rate-limit defaults

| Knob               | Default    |
|--------------------|------------|
| Inter-deletion     | 6–14 s     |
| Long break every   | 30 deletes |
| Long-break length  | 60–180 s   |
| Hourly cap         | 360        |
| Daily cap          | 1500       |
| Errors → 30m pause | 3          |
| Errors → abort     | 10         |

Tunable via env later; defaults are deliberately conservative.

## Caveats

- Browser automation of your own account for content deletion sits in a grey
  area of X's terms. We mirror what Cyd, Redact, XDelete do. Use a real
  account at your own discretion.
- Selectors snapshot the X DOM on **2026-04-27**. Expect periodic breakage;
  the diagnostic bundle and the fixture-HTML tests are designed to make
  recovery quick.
- No CAPTCHA solving, no proxy rotation, no headless-stealth tricks. If X
  challenges you, the run aborts and you handle it as a human.

## Docs

- [`docs/PLAN.md`](docs/PLAN.md) — goals, architecture, decisions, milestones
- [`docs/architecture.md`](docs/architecture.md) — design rationale
- [`docs/selectors.md`](docs/selectors.md) — X DOM reference (verified live)
- [`docs/rate-limits.md`](docs/rate-limits.md) — pacing strategy
- [`docs/testing.md`](docs/testing.md) — three-layer test strategy
- [`docs/research.md`](docs/research.md) — sources and prior art

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, hooks, branch
naming, and the PR checklist. Security issues: see [`SECURITY.md`](SECURITY.md).

## Author

**Babak Bandpey** — [cocode.dk](https://cocode.dk) | [LinkedIn](https://linkedin.com/in/babakbandpey) | [GitHub](https://github.com/cocodedk)

## License

Apache-2.0 | © 2026 [Cocode](https://cocode.dk) | Created by [Babak Bandpey](https://linkedin.com/in/babakbandpey)
