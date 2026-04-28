# x-cleaner — Plan

A local tool that deletes the user's own posts and replies on x.com by driving
a logged-in browser session. Slow, randomized pace; resumable; never touches
anyone else's account.

## Goals

- Delete **own posts** (originals, replies, reposts) selectively or in bulk.
- Use a **logged-in browser** the user controls — no password automation, no
  third-party server, no API tokens.
- **Pace conservatively** to avoid "rate limit exceeded" / soft-bans (see
  [rate-limits.md](rate-limits.md)).
- **Resumable**: state persisted to disk; safe to Ctrl-C and restart.
- **Auditable**: dry-run preview, per-action log, exportable report.

## Non-goals

- Deleting other people's content, mass-blocking, follower manipulation, or any
  engagement automation. Those are flagged categories under X's automation
  rules and risk account suspension.
- Bypassing OAuth / scraping at scale / running on someone else's account.
- Fighting bot detection. If X serves a CAPTCHA or cool-down, we stop and ask
  the user.

## Architecture (chosen)

**Standalone Node + Playwright script with a persistent Chromium profile.**

```
┌─────────────────────────────────────────────────────────────┐
│ user terminal                                               │
│   └── pnpm start -- --mode=replies --max=200 --dry-run      │
│         │                                                   │
│         ▼                                                   │
│   src/cli.ts        (argparse, config, resume state)        │
│         │                                                   │
│         ▼                                                   │
│   src/source/*.ts   (timeline scraper | archive reader)     │
│         │                                                   │
│         ▼                                                   │
│   src/delete.ts     (per-post URL → click → confirm)        │
│         │                                                   │
│         ▼                                                   │
│   Playwright Chromium  (persistent profile, user logged in) │
└─────────────────────────────────────────────────────────────┘
   │
   └── state/  ← jsonl log, processed-id set, last cursor
```

Why this and not the alternatives — see [architecture.md](architecture.md).

## Source of "what to delete" (v1)

**Live timeline scrape** of `https://x.com/<handle>/with_replies`.

For each `article[data-testid="tweet"]` rendered on the page:
1. Detect whether it's the user's reply (presence of a "Replying to @…" link
   inside the article) — skip otherwise.
2. Read the canonical status URL from the timestamp anchor.
3. Push onto the in-memory queue.
4. After the visible window is exhausted, scroll, wait for new cards, repeat.
5. Stop when scrolling no longer yields new IDs (with a few retries to
   tolerate virtualization).

The scrolling/virtualization handling mirrors XDelete's recursive
"process the first un-handled card, then again" loop — see
[research.md](research.md) and [selectors.md](selectors.md).

The archive-based path is tested and ready, but not wired into v1.

## Filters

CLI flags consumed by both sources:

- `--mode=posts|replies|reposts|likes|all`
- `--older-than=30d` / `--newer-than=2024-01-01`
- `--keep-min-likes=N` / `--keep-min-replies=N`
- `--match=<regex>` / `--exclude=<regex>` (against tweet text)
- `--dry-run` (preview only; nothing is clicked)
- `--max=N` (hard cap per session — important for first runs)

## Per-item flow

1. Navigate to `https://x.com/<handle>/status/<id>`.
2. If 404 → already deleted; mark done; skip.
3. Click `[data-testid="caret"]` on the focused post.
4. Wait for `[role="menu"]`; find `[role="menuitem"]` with text "Delete".
5. Click it; wait for `[data-testid="confirmationSheetConfirm"]`.
6. Click confirm. Wait for redirect / toast.
7. Persist outcome to `state/log.jsonl`.
8. Sleep with jittered delay before the next item.

For reposts: click `[data-testid="unretweet"]` then `[data-testid="unretweetConfirm"]`.
Selectors and edge cases live in [selectors.md](selectors.md).

## Milestones

1. **M1 — skeleton + login**: Playwright bootstrap, persistent profile,
   `pnpm dev login` opens browser so user logs in once. _0.5d_
2. **M2 — single-item deletion**: hardcoded URL, full click flow, dry-run
   support. _0.5d_
3. **M3 — reply detector + scraper**: identify reply cards on `/with_replies`,
   walk the page with virtualization-aware scrolling, build a queue of
   status URLs. _1d_
4. **M4 — pacing engine**: jittered delays (base 10s, ±40%), hourly cap 360,
   daily cap 1500, long-break every ~30 deletes, abort-on-anomaly. _0.5d_
5. **M5 — resume + reporting**: `state/log.jsonl`, `state/processed.json`,
   `--resume`, end-of-run summary. _0.5d_
6. **M6 — polish**: README, error categorisation, CAPTCHA detection,
   visible-mode UX touches. _0.5d_

Archive reader (parsed and tested) and posts/reposts modes are deferred
post-v1.

Total: ~3 days of focused work for the v1 MVP.

## Risks

- **Selectors break.** X ships frequent UI changes. Mitigation: every selector
  is centralized in `src/selectors.ts`, validated on startup against a known
  test post; fail loudly if a probe fails.
- **Rate-limit / soft-ban.** Mitigation: conservative defaults, exponential
  backoff on detected blocks, hard daily cap, explicit user opt-in to raise.
- **TOS exposure.** Browser automation of your own account for content
  deletion sits in a grey area. We mirror what Cyd, Redact, and XDelete do.
  Document this clearly in the README; user accepts on first run.
- **Account lock during run.** Mitigation: detect `/account/access` redirect
  and stop immediately with a clear message; never attempt to "solve" a
  challenge programmatically.

## Decisions locked for v1 (2026-04-27)

| Q                | Answer                                                  |
|------------------|---------------------------------------------------------|
| Input source     | **Live timeline scrape only.** No archive in v1.        |
| Scope            | **Replies only.** No originals, no reposts, no likes.   |
| Browser          | **Visible Chromium.** User watches, can abort.          |
| Pace target      | **6 / minute** → base 10s with ±40% jitter = 6–14s gap. |

Implications:
- Source is the user's `/<handle>/with_replies` page; we identify reply
  cards via the "Replying to" indicator in each `article`.
- Default `mode=replies` on the filter; `posts`/`reposts` paths stay
  implemented and tested but unused in v1.
- Archive parser stays in the codebase as a tested module so it can be
  switched in later without rework.
- Hourly cap drops to 360 (= sustained 6/min), daily cap 1500.

See [research.md](research.md) for sources and prior art.
