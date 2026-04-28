# Contributing to x-cleaner

## Local Setup

1. Install Node.js 20+.
2. Clone the repo and install dependencies:
   ```sh
   npm install
   npx playwright install chromium
   ```
3. Install the git hooks:
   ```sh
   ./scripts/install-hooks.sh
   ```

## Local Git Setup

Run these once after cloning:

```sh
git config pull.rebase true
git config core.autocrlf input          # macOS/Linux; use `true` on Windows
git config push.autoSetupRemote true
git config init.defaultBranch main
```

## Build, Test, and Lint Commands

```sh
npm run typecheck           # tsc --noEmit
npm test                    # vitest run (unit + Playwright fixture-HTML)
npm run test:watch          # vitest in watch mode
npm run start -- --help     # CLI entry
```

The pre-commit hook runs `typecheck` then `test`. Push fails on bad commit messages — see Conventional Commits below.

## Coding Style

- TypeScript strict mode is on. Don't loosen `tsconfig.json`.
- Files under **200 lines**. Split into helpers when you approach the limit.
- Pure logic in `src/pace.ts`, `src/scheduler.ts`, `src/errors.ts`, `src/state.ts`, `src/filter.ts` — these stay free of Playwright.
- Browser-driving code in `src/browser.ts`, `src/scrape.ts`, `src/delete.ts`, `src/diagnose.ts`, `src/runner.ts`.
- Selectors live in **one place**: `src/selectors.ts`. Never inline a selector at the call site.
- When a selector breaks, update both `src/selectors.ts` and the matching fixture in `test/fixtures/` so the test suite stays representative.

## Branch Naming

| Branch prefix | Conventional Commit type | Example |
|---|---|---|
| `feature/` | `feat:` | `feature/likes-runner` |
| `fix/` | `fix:` | `fix/caret-menu-detection` |
| `chore/` | `chore:` | `chore/bump-playwright` |
| `docs/` | `docs:` | `docs/refresh-selectors` |
| `refactor/` | `refactor:` | `refactor/extract-throttle` |
| `ci/` | `ci:` | `ci/cache-playwright` |

Branch names use **kebab-case**. Never commit directly to `main`.

## Conventional Commits

The `commit-msg` hook enforces:

```
<type>(<optional scope>): <description>
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `build`, `perf`, `revert`.

## PR Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] If you touched deletion logic — manual `--dry-run` against your own account, attach the printed plan
- [ ] If a selector changed — fixture HTML updated, tests still cover the new shape
- [ ] No regressions in adjacent surfaces (replies / likes / posts)

## Release Process

Releases run via the `Release` workflow (manual dispatch). Pick `patch`, `minor`, or `major`. The workflow creates `vMAJOR.MINOR.PATCH` and a GitHub Release with auto-generated notes — no artifact upload, this is a CLI you run from source.
