# CLAUDE.md — x-cleaner

## Project Overview

x-cleaner is a local Node.js + TypeScript + Playwright tool that deletes the user's own X.com (Twitter) replies. It drives a persistent Chromium profile against a logged-in session — no API tokens, no third-party server, no password automation. v1 covers replies; originals/reposts/likes modules exist and are tested but not yet wired into the CLI.

- **Language / Runtime**: TypeScript 5.7 on Node.js 20+
- **Test runner**: Vitest 2.1 (unit + Playwright fixture-HTML integration)
- **Browser driver**: Playwright 1.59 (`chromium` channel, persistent context)
- **Execution**: `tsx` runs `src/cli.ts` directly — no build step in dev
- **Module style**: ESM (`"type": "module"`), strict TS with `noUncheckedIndexedAccess`

---

## Required Skills — ALWAYS Invoke These

| Situation | Skill |
|-----------|-------|
| Before any new feature or screen | `superpowers:brainstorming` |
| Planning multi-step changes | `superpowers:writing-plans` |
| Writing or fixing core logic | `superpowers:test-driven-development` |
| First sign of a bug or failure | `superpowers:systematic-debugging` |
| Before completing a feature branch | `superpowers:requesting-code-review` |
| Before claiming any task done | `superpowers:verification-before-completion` |
| Working on UI / frontend (website) | `frontend-design:frontend-design` |
| After implementing — reviewing quality | `simplify` |

---

## Architecture

```
src/
├── pace.ts          ← pure: jittered delays, seeded RNG, long-break logic
├── scheduler.ts     ← pure: hourly/daily caps + abort-on-anomaly
├── errors.ts        ← pure: signal → action classifier (continue/retry/backoff/abort)
├── state.ts         ← pure(-ish): jsonl log + processed-set + atomic flush
├── archive.ts       ← pure: Twitter-archive parser (deferred input source)
├── filter.ts        ← pure: mode/age/likes/regex filtering (deferred)
├── selectors.ts     ← pure data: all DOM selectors live here, nowhere else
├── replyDetector.ts ← pure: identify reply cards on /with_replies
├── humanCursor.ts   ← pure: bezier-path mouse moves (anti-bot mitigation)
├── scrape.ts        ← Playwright: virtualization-aware scroll & enumerate
├── delete.ts        ← Playwright: caret → Delete → confirm
├── diagnose.ts      ← Playwright: screenshot + DOM + a11y dump on error
├── unlike.ts        ← Playwright: like-button toggle (deferred)
├── browser.ts       ← Playwright: persistent-profile Chromium launcher
├── runner.ts        ← orchestrator: glues scheduler + queue + delete + state + diagnose
└── cli.ts           ← `login | probe | run | unlike` subcommands
```

### Layer Rules

- **Pure modules** (`pace`, `scheduler`, `errors`, `state`, `archive`, `filter`, `selectors`, `replyDetector`, `humanCursor`) must NEVER import `playwright`. Test them with vitest unit tests, no fixtures.
- **Playwright modules** import pure modules freely but never the other way around.
- **Selectors live in one file** (`src/selectors.ts`). Never inline a selector at the call site. When X changes its DOM, you update one file and the matching fixture in `test/fixtures/`.
- **Diagnostic bundles** are emitted by `diagnose.ts` to `state/diagnostics/<ts>-<reason>/`. Never delete these without the user's consent — they are the recovery path when selectors rot.

---

## Coding Conventions

- Strict TypeScript; never weaken `tsconfig.json`.
- Pure functions where possible — pacing, classification, filtering must be deterministic given a seed.
- Single source of truth per concern — RNG seed lives in `pace.ts`, caps live in `scheduler.ts`, selectors in `selectors.ts`.
- No hardcoded selectors at call sites.
- No silent error swallowing — classify via `errors.ts` and let the runner act.
- ESM imports use `.ts` extensions (project has `allowImportingTsExtensions: true`).

---

## Engineering Principles

### File Size

- **200-line maximum per file**. Extract a function, helper, or module when approaching the limit.

### DRY · SOLID · KISS · YAGNI

- Extract shared logic; never copy-paste selectors or pacing constants.
- Single responsibility — `delete.ts` does the delete sequence and nothing else; the runner composes.
- Don't add features not on the active milestone in `docs/PLAN.md`.
- Delete dead code immediately.

### TDD

- Write the failing test first, make it pass, then refactor.
- Pure modules → unit tests in `test/*.test.ts`.
- DOM-touching modules → integration tests against static fixtures in `test/fixtures/*.html`.
- E2E (gated behind `X_CLEANER_E2E=1`) is for hand verification against a throwaway account — not part of CI.

### Safety

- Default to `--dry-run`. The first thing any new deletion-touching code should support is dry-run.
- Respect the abort-on-anomaly thresholds (3 errors → 30 min pause; 10 errors → abort). Don't tune these without an entry in `docs/PLAN.md`.
- Never log handles, tokens, or full URLs to stdout in committed code.

### Commit hygiene

- Conventional Commits, enforced by `.githooks/commit-msg`.
- Pre-commit runs `npm run typecheck && npm test`. If it's slow, profile — don't bypass with `--no-verify`.

---

## Build Commands

```sh
npm run typecheck            # tsc --noEmit (fast)
npm test                     # vitest run (unit + Playwright fixture-HTML)
npm run test:watch           # vitest watch mode
npm run start -- --help      # CLI entry via tsx
npm run login                # interactive login flow
npm run probe                # verify saved login still works
npm run run:cleaner -- --handle=<your-handle> --dry-run --max=20
```

The "smoke check" used by CI and the pre-commit hook is: `npm run typecheck && npm test`.

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | This file — conventions and session startup |
| `version.txt` | Informational semver marker (source of truth: git tags) |
| `.github/workflows/ci.yml` | Typecheck + vitest on every push and PR to main |
| `.github/workflows/release.yml` | Manual dispatch tags `vX.Y.Z` and creates a GitHub Release |
| `.github/workflows/deploy-pages.yml` | Pushes `website/**` to GitHub Pages |
| `.githooks/pre-commit` | typecheck + test |
| `.githooks/commit-msg` | Conventional Commits enforcement |
| `scripts/install-hooks.sh` | One-time hook installer |
| `scripts/setup-repo.sh` | One-time branch protection + repo settings |
| `docs/PLAN.md` | Goals, milestones, decisions |
| `docs/selectors.md` | X DOM reference (snapshot date inside) |

---

## Starting a New Session

1. Read this file.
2. Run `npm run typecheck && npm test` to confirm everything passes.
3. Skim `docs/PLAN.md` to know which milestone is active.
4. Invoke `superpowers:brainstorming` before touching any feature.
5. Follow the Required Skills table — every skill is mandatory, not optional.
