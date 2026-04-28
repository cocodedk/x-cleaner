# Research notes (2026-04-27)

Inspiration drawn from existing tools that survived the post-API-shutdown era
on X. Common pattern across all of them: drive a logged-in browser, no API.

## Prior art

### Cyd — https://cyd.social
Desktop app (Win/Mac/Linux). Acts as "a specialized web browser logged into
your account", scrolls and clicks. Builds a SQLite archive of your data
alongside deletion. Free; premium ~$36/yr. No public source for the deletion
engine. Closest design to what we want.

### Redact — https://redact.dev
Desktop app, supports many platforms beyond X. Has Preview Mode, Disappearing
Mode (continuous policy), filter-driven Deletion Mode. Confirms the value of
filter-first UX even for a CLI.

### tweetus-deletus — Jamie Tanna
TypeScript + Playwright; consumes Twitter archive `tweets.js` and clicks the
UI item-by-item. Confirms that "archive in, click out" is a workable shape.

### XDelete — github.com/techleadhd/XDelete
Pure browser-console JS. Selectors:
- `[data-testid="tweet"]`, `[data-testid="caret"]`
- `[role="menuitem"]` matched by text
- `[data-testid="confirmationSheetConfirm"]`
- `[data-testid="unretweet"]` / `[data-testid="unretweetConfirm"]`
Delays 250ms–2s with ±25% jitter. Tracks processed nodes with a Set.
Scrolls to load more then waits 5s. We borrow these selectors directly.

### Chris Smith blog — chrissmith.xyz/blog/2024/bulk-deleting-tweets
Personal account: ~4000 tweets via console script. Findings:
- 500ms between micro-actions, 5s between deletions
- Recursive "process the first tweet, then again" handles virtualization
- Validate selectors and verify menu-item text before clicking
- Keep the account, just empty it (prevents impersonation)

### TweetDelete (paid service)
Uses the API: ceiling of ~15k deletions/hour. Useful as the upper bound on
what X tolerates from a well-behaved authenticated client. Our browser-based
ceiling should be much lower.

## Driver comparison

Both reviewed:

- **Playwright MCP** (microsoft/playwright-mcp): persistent profile, exposes
  `browser_navigate`, `browser_click`, `browser_snapshot`. Good for human-in-
  the-loop exploration. Wrong shape for thousands of deletions because every
  click is a tool-call round-trip.
- **Chrome DevTools MCP**: stronger at debugging/inspection, weaker at
  driving long-running flows. Not the right tool here.

We use raw Playwright. MCP variants stay in the toolbox for selector probing.

## Detection notes

Aggregating from multiple sources (latenode, capmonster, dev.to deep dive):
- Headless Chromium has distinct fingerprints (`navigator.webdriver`, missing
  plugins, default fonts). Running visible Chromium with a real user profile
  avoids this entire class of issue.
- Behavioral signals (uniform timing, no idle gaps, no scroll variance) are
  what catches "real browser, fake user" automations. Jitter + long breaks
  address this.
- IP reputation matters less for own-account actions on a residential IP than
  it does for scraping.

## Sources

- [Cyd — Lockdown Systems](https://lockdown.systems/delete-all-your-tweets-for-free-with-cyd/)
- [Cyd homepage](https://cyd.social/)
- [Redact — Twitter service](https://redact.dev/services/twitter)
- [tweetus-deletus blog](https://www.jvt.me/posts/2023/09/30/tweetus-deletus/)
- [XDelete on GitHub](https://github.com/techleadhd/XDelete)
- [Chris Smith — Bulk deleting tweets](https://chrissmith.xyz/blog/2024/bulk-deleting-tweets/)
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Twitter/X Automation Rules 2026 — OpenTweet](https://opentweet.io/blog/twitter-automation-rules-2026)
- [Twitter API changes for deletion tools — DeleteOldPosts](https://www.deleteoldposts.com/guide/twitter-api-changes-2026)
- [Browser automation detection deep dive — dev.to](https://dev.to/digitalgrowthpro/understanding-browser-automation-detection-a-technical-deep-dive-for-developers-l4a)
- [Avoiding bot detection — Latenode](https://latenode.com/blog/web-automation-scraping/avoiding-bot-detection/how-to-detect-headless-browsers-and-protect-your-website-from-bots)
- [Scraping Twitter with Playwright — Jonathan Soma](https://jonathansoma.com/everything/scraping/scraping-twitter-playwright/)
