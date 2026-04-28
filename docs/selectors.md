# X.com DOM reference (as of 2026-04)

**Volatility warning:** X ships UI changes frequently. Treat this file as a
snapshot. Validate on startup against a known test post; fail loudly if any
probe selector is missing.

## Tweet container

- `article[data-testid="tweet"]` — wraps a single tweet card
- Within: `time` element with `datetime` attribute → timestamp
- Within: anchor whose `href` matches `/<user>/status/<id>` → canonical URL

## Open the action menu

- `[data-testid="caret"]` — the "···" button on a tweet
  - Note: a single page may contain many `caret` buttons (one per tweet). When
    on a tweet permalink, use `:scope >>> ` selectors or scope to the focused
    article via `article[tabindex="-1"][data-testid="tweet"]`.

## The action menu

- `[role="menu"]` — appears after caret click
- `[role="menuitem"]` — each row inside
  - Match by visible text: `"Delete"` for own post, `"Undo repost"` for repost
  - Always re-verify text — X reorders menu items and localizes them

## Confirmation modal

- `[data-testid="confirmationSheetConfirm"]` — "Delete" button in modal for
  originals and replies
- `[data-testid="unretweetConfirm"]` — confirm button for repost removal

## Repost-specific shortcut

- `[data-testid="unretweet"]` — sometimes available directly on the tweet's
  repost button without needing the caret menu

## Toasts and post-action signals

- After successful delete, page typically navigates back or shows a toast.
  Don't rely on toast text — instead, re-check that the URL no longer resolves
  to a tweet (returns 404 / "page doesn't exist").

## Login / challenge surfaces

Verified live (2026-04-27, unauthenticated headless visit):

- Visiting `/<handle>/with_replies` while logged-out **silently redirects** to
  `https://x.com/i/flow/login?redirect_after_login=...`. The new URL — not the
  page content — is the authoritative "you are not logged in" signal.
- Landing page (`https://x.com/`) shows `[data-testid="loginButton"]` and
  `[data-testid="signupButton"]` only when logged out. Their absence is a
  decent secondary heuristic.
- `/i/flow/login` username step uses `input[autocomplete="username"]`. The
  password step (after username submitted) shows
  `[data-testid="LoginForm_Login_Button"]`. Both are user-driven — we never
  automate the actual login.
- `/account/access` — challenge / locked account.
- A cookie banner appears on fresh profiles ("Did someone say … cookies?").
  First-run UX should warn the user to dismiss it before deletion starts.

If any of these appear during a delete run, **abort and notify the user**.

## Probe routine (run on startup)

1. Navigate to `https://x.com/home`.
2. Assert URL is `x.com/home` (else — login redirect detected).
3. Assert at least one `article[data-testid="tweet"]` appears within 15s.
4. Visit `https://x.com/<self>/status/<known-pinned-id>`.
5. Assert `[data-testid="caret"]` is clickable.

If all four pass, selectors are healthy enough to proceed.
