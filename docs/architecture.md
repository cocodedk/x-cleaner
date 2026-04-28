# Architecture decisions

## Why browser automation, not the X API

- The official X API v2 has aggressive rate limits and pricing tiers that make
  bulk deletion impractical for an individual.
- API access requires app credentials and OAuth — more friction than a logged-in
  browser, and more attack surface for token leaks.
- Most surviving deletion tools (Cyd, Redact, tweetus-deletus, XDelete) all
  abandoned the API and now drive the UI.

## Why standalone Playwright (not MCP-driven)

The user asked about Playwright MCP and Chrome DevTools MCP. Both work fine for
exploration and for one-off deletes during development. They are the wrong
shape for the production workload:

| Concern              | Playwright (script)        | Playwright MCP / DevTools MCP    |
|----------------------|----------------------------|----------------------------------|
| Token cost / 1000 deletes | zero                  | thousands of tool-call rounds    |
| Pacing precision     | exact `setTimeout` control | depends on agent loop latency    |
| Resumability         | trivial (script + state)   | requires re-priming the agent    |
| Determinism          | high                       | lower (LLM in the loop)          |
| Dev iteration speed  | medium                     | high                             |

**Conclusion:** ship as a Node script. Use Playwright MCP only for ad-hoc
exploration and selector probing during development.

## Why a persistent profile (not OAuth / scripted login)

- X's automation rules explicitly call out password-driven scripted login as
  unauthorized. Persistent profile = "user logs in once in a real browser",
  which is a normal user action.
- Avoids storing passwords or 2FA secrets anywhere.
- Survives restarts cleanly: cookies and localStorage are on disk, owned by
  the user.

Profile path: `./.profile/` inside the project directory, gitignored.

## Live scrape for v1, archive deferred

V1 uses live timeline scraping of `/<handle>/with_replies` because the user
wants to start without the 24–48h archive download.

Scrape loop handles X's virtualized timeline with a "track processed cards by
status-id, scroll, wait, recheck" cycle (XDelete pattern). Edge cases:
items that unmount before we click them are recovered on the next pass.

The archive-based code path stays in the repo as a tested module — when the
user later downloads an archive, the input adapter swap is a one-line change
in the queue builder.

## State layout

```
state/
├── log.jsonl         append-only line per attempt: ts, id, action, result
├── processed.json    { "<id>": "deleted" | "not-found" | "skipped" }
├── queue.json        remaining work (regenerated per run from source+filters)
└── session.json      current run id, started_at, mode, filter snapshot
```

Resume reads `processed.json` and skips anything already terminal.

## Failure handling

| Detected condition                                  | Action                            |
|-----------------------------------------------------|-----------------------------------|
| Page 404                                            | mark deleted, continue            |
| `caret` not found within 10s                        | screenshot, mark error, continue  |
| Confirm button not found                            | screenshot, mark error, continue  |
| Redirect to `/i/flow/login` or `/account/access`    | **abort run**, prompt user        |
| HTTP 429 / "rate limit" toast                       | exponential backoff, then abort   |
| 3 consecutive errors                                | pause 30 min, then continue       |
| 10 consecutive errors                               | abort                             |

Screenshots land in `state/screenshots/<ts>-<reason>.png` for forensics.
