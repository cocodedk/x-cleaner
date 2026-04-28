# Rate-limit & pacing strategy

X's anti-automation defenses look at multiple signals: per-action throughput,
inter-action timing uniformity, session length, and behavioral fingerprints.
Beating uniform-timing detection is the single biggest lever we have, and it's
free.

## Defaults (v1: target 6 deletes / minute)

| Knob                          | Default              | Notes                        |
|-------------------------------|----------------------|------------------------------|
| Inter-deletion delay          | 6–14 s               | base 10s ± 40% jitter        |
| Micro-action delay (in modal) | 400–900 ms           | between caret/menu/confirm   |
| Scroll pause (scrape loop)    | 4–8 s                | longer than micro            |
| Long break every N deletes    | 30 (±5)              | 60–180 s pause               |
| Hourly cap                    | 360                  | matches sustained 6/min      |
| Daily cap                     | 1500                 | hard ceiling                 |
| Consecutive-error threshold   | 3 → 30 min pause     | 10 → abort                   |

Numbers chosen to sit well below known soft-ban thresholds reported by
TweetDelete (15k/hour ceiling on the API side) and below the implicit
thresholds at which Chris Smith and tweetus-deletus reported success with
5s gaps. The 6/min target is the user's stated comfort level for v1.

## Why jitter matters

A perfectly uniform 5s gap is a stronger automation signal than a 3-9s
distribution averaging the same. We use:

```
delay_ms = base + (random() - 0.5) * 2 * jitter
```

with `jitter = 0.4 * base` (±40%). This produces a believable spread without
ever going below a safe floor.

## Long-break logic

Even with jittered delays, a 4-hour uninterrupted session is its own pattern.
Every ~30 deletions we insert a 60–180s pause to mimic a user being
distracted. After ~200 deletions in an hour, we recommend stopping for the
day; the daily cap enforces this.

## Detecting trouble

Watch for any of these and react:

- HTTP 429 from any `x.com` request observed via Playwright's network listener
- Toast text containing "rate limit", "try again", "something went wrong"
- Redirect to `/account/access` mid-run
- The same delete attempt failing twice with the same selector timeout

Reaction ladder:

1. First sign → pause 5 min, retry once.
2. Second sign within 30 min → pause 30 min.
3. Third sign within 2 h → abort the run with a clear message.

## What we explicitly do NOT do

- **No headless browser.** Headless Chromium fingerprints differ from real
  Chromium. Run visible by default.
- **No stealth plugins.** They are an arms race we don't need to fight; running
  a normal logged-in browser at human pace is enough for own-account deletion.
- **No proxy rotation.** Same reason. Single residential IP, same one the user
  always uses.
- **No CAPTCHA solving.** If X challenges us, it has decided it wants a human
  in the loop, and we should give it one.

## Tunable, but with brakes

Users can lower the caps freely. Raising caps requires a `--i-know-what-im-doing`
flag and is logged loudly. The defaults are designed for a first-time run on
a 5-year-old account with thousands of items.
